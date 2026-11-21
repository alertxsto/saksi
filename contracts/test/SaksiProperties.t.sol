// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ControllerRegistry} from "../src/ControllerRegistry.sol";
import {AccessJournal} from "../src/AccessJournal.sol";
import {BreachReport} from "../src/BreachReport.sol";

interface PropertyVm {
    function prank(address caller) external;
    function warp(uint256 timestamp) external;
}

PropertyVm constant VM = PropertyVm(address(uint160(uint256(keccak256("hevm cheat code")))));
address constant WRITER = address(0xA11CE);
bytes32 constant ID = keccak256("ctrl:demo-one");
uint64 constant START = 1_700_000_000;

function bound64(uint256 value, uint64 min, uint64 max) pure returns (uint64) {
    return uint64(min + (value % (uint256(max) - min + 1)));
}

/// Fuzzed properties of the access journal, registry access control, and the 72-hour breach window.
contract SaksiFuzzTest {
    ControllerRegistry private registry;
    AccessJournal private journal;
    BreachReport private breach;

    function setUp() public {
        VM.warp(START);
        registry = new ControllerRegistry();
        journal = new AccessJournal(registry);
        breach = new BreachReport(registry);
        registry.register(ID, WRITER, "Demo One");
    }

    /// Only the EOA bound to a controller id can write access receipts for it.
    function testFuzzOnlyBoundControllerCanLog(address caller, uint8 eventType) public {
        if (caller == WRITER) return;
        VM.prank(caller);
        (bool ok, bytes memory data) = address(journal).call(
            abi.encodeCall(AccessJournal.logAccess, (ID, bytes32(0), bytes32(0), bytes32(0), eventType % 4, bytes32(0)))
        );
        assert(!ok && bytes4(data) == AccessJournal.NotAuthorized.selector);
    }

    /// The authorized controller succeeds exactly for event types 0..3.
    function testFuzzEventTypeDomain(uint8 eventType, bytes32 subject, bytes32 evidence) public {
        VM.prank(WRITER);
        (bool ok, bytes memory data) = address(journal).call(
            abi.encodeCall(AccessJournal.logAccess, (ID, subject, bytes32(0), bytes32(0), eventType, evidence))
        );
        if (eventType <= 3) assert(ok);
        else assert(!ok && bytes4(data) == AccessJournal.InvalidEventType.selector);
    }

    /// No address other than the deployer can bind or revoke controller keys.
    function testFuzzNonAdminCannotRegisterOrRevoke(address caller, bytes32 id) public {
        if (caller == address(this)) return;
        VM.prank(caller);
        (bool okRegister, bytes memory registerData) =
            address(registry).call(abi.encodeCall(ControllerRegistry.register, (id, caller, "x")));
        VM.prank(caller);
        (bool okRevoke, bytes memory revokeData) = address(registry).call(abi.encodeCall(ControllerRegistry.revoke, (ID)));
        assert(!okRegister && bytes4(registerData) == ControllerRegistry.NotAdmin.selector);
        assert(!okRevoke && bytes4(revokeData) == ControllerRegistry.NotAdmin.selector);
        assert(registry.isAuthorized(ID, WRITER));
    }

    /// For any past detection time, exactly one of anchor / anchorLate accepts the report, and the accepted
    /// path matches the 72-hour rule: on time iff anchoredAt - detectedAt <= WINDOW.
    function testFuzzExactlyOneAnchorPathAccepts(uint256 nowSeed, uint256 elapsedSeed) public {
        uint64 nowTs = bound64(nowSeed, START, START + 3650 days);
        // Half the runs stay near the 72-hour boundary; the rest cover the whole past.
        uint64 elapsed = elapsedSeed % 2 == 0 ? bound64(elapsedSeed >> 1, 0, 6 days) : bound64(elapsedSeed >> 1, 0, nowTs);
        uint64 detectedAt = nowTs - elapsed;
        VM.warp(nowTs);

        VM.prank(WRITER);
        (bool onTime, bytes memory onTimeData) =
            address(breach).call(abi.encodeCall(BreachReport.anchor, (ID, keccak256("a"), bytes32(0), detectedAt)));
        VM.prank(WRITER);
        (bool late, bytes memory lateData) =
            address(breach).call(abi.encodeCall(BreachReport.anchorLate, (ID, keccak256("b"), bytes32(0), detectedAt)));

        assert(onTime != late);
        assert(onTime == (elapsed <= breach.WINDOW()));
        if (onTime) assert(bytes4(lateData) == BreachReport.NotLate.selector);
        else assert(bytes4(onTimeData) == BreachReport.ClaimedWindowExpired.selector);
    }
}

/// Drives random anchor / anchorLate calls over a small set of report hashes so duplicates are frequent.
contract BreachHandler {
    BreachReport public immutable breach;
    bytes32[] public anchored;
    mapping(bytes32 => uint64) public firstAnchoredAt;
    mapping(bytes32 => uint64) public detectedOf;
    mapping(bytes32 => bool) public wasLate;
    uint256 public duplicateAccepted;

    constructor(BreachReport b) {
        breach = b;
    }

    function anchorAny(uint8 reportSeed, uint32 advance, uint32 detectedBack, bool late) external {
        VM.warp(block.timestamp + (advance % 2 days));
        uint64 nowTs = uint64(block.timestamp);
        uint64 detectedAt = nowTs - uint64(detectedBack % 6 days);
        bytes32 report = keccak256(abi.encode(reportSeed % 8));

        VM.prank(WRITER);
        bool ok;
        if (late) (ok,) = address(breach).call(abi.encodeCall(BreachReport.anchorLate, (ID, report, bytes32(0), detectedAt)));
        else (ok,) = address(breach).call(abi.encodeCall(BreachReport.anchor, (ID, report, bytes32(0), detectedAt)));
        if (!ok) return;

        if (firstAnchoredAt[report] != 0) duplicateAccepted++;
        else anchored.push(report);
        firstAnchoredAt[report] = nowTs;
        detectedOf[report] = detectedAt;
        wasLate[report] = late;
    }

    function anchoredCount() external view returns (uint256) {
        return anchored.length;
    }
}

/// Stateful invariants of BreachReport under random call sequences.
/// forge-config: default.invariant.runs = 64
/// forge-config: default.invariant.depth = 200
contract BreachInvariantTest {
    ControllerRegistry private registry;
    BreachReport private breach;
    BreachHandler private handler;

    function setUp() public {
        VM.warp(START);
        registry = new ControllerRegistry();
        breach = new BreachReport(registry);
        handler = new BreachHandler(breach);
        registry.register(ID, WRITER, "Demo One");
    }

    function targetContracts() public view returns (address[] memory targets) {
        targets = new address[](1);
        targets[0] = address(handler);
    }

    /// A report hash is accepted at most once; later calls never overwrite its timestamp.
    function invariant_reportAnchoredAtMostOnce() public view {
        assert(handler.duplicateAccepted() == 0);
        uint256 count = handler.anchoredCount();
        for (uint256 i = 0; i < count; i++) {
            bytes32 report = handler.anchored(i);
            assert(breach.anchoredAt(report) == handler.firstAnchoredAt(report));
        }
    }

    /// Every accepted report is classified by the contract exactly as the 72-hour rule says.
    function invariant_classificationMatchesWindow() public view {
        uint256 count = handler.anchoredCount();
        for (uint256 i = 0; i < count; i++) {
            bytes32 report = handler.anchored(i);
            uint64 elapsed = handler.firstAnchoredAt(report) - handler.detectedOf(report);
            assert(handler.wasLate(report) == (elapsed > breach.WINDOW()));
        }
    }
}

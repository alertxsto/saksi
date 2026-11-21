// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ControllerRegistry} from "../src/ControllerRegistry.sol";
import {AccessJournal} from "../src/AccessJournal.sol";
import {BreachReport} from "../src/BreachReport.sol";

interface TestVm {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function prank(address caller) external;
    function warp(uint256 timestamp) external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata data) external;
    function expectEmit(bool topic1, bool topic2, bool topic3, bool data, address emitter) external;
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}

contract SaksiTest {
    TestVm private constant vm = TestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant WRITER = address(0xA11CE);
    address private constant REPLACEMENT = address(0xB0B);
    bytes32 private constant ID = keccak256("ctrl:demo-one");
    bytes32 private constant SUBJECT = bytes32(uint256(2));
    bytes32 private constant PURPOSE = bytes32(uint256(3));
    bytes32 private constant BASIS = bytes32(uint256(4));
    bytes32 private constant EVIDENCE = bytes32(uint256(5));
    bytes32 private constant REPORT = bytes32(uint256(6));
    bytes32 private constant COUNT = bytes32(uint256(7));
    uint64 private constant DETECTED = 1_700_000_000;
    uint64 private constant DEADLINE = 1_700_259_200;

    ControllerRegistry private registry;
    AccessJournal private journal;
    BreachReport private breach;

    event ControllerRegistered(bytes32 indexed controllerId, address indexed eoa, string name);
    event ControllerRevoked(bytes32 indexed controllerId, address indexed eoa);
    event AccessLogged(
        bytes32 indexed controllerId,
        bytes32 indexed subjectPseudonym,
        bytes32 indexed evidenceHash,
        bytes32 purposeHash,
        bytes32 legalBasisKey,
        uint8 eventType,
        uint64 timestamp
    );
    event BreachAnchored(
        bytes32 indexed controllerId,
        bytes32 indexed reportHash,
        bytes32 affectedCountHash,
        uint64 detectedAt,
        uint64 anchoredAt,
        uint64 deadline
    );
    event LateBreachAnchored(
        bytes32 indexed controllerId,
        bytes32 indexed reportHash,
        bytes32 affectedCountHash,
        uint64 detectedAt,
        uint64 anchoredAt,
        uint64 lateBy
    );

    function setUp() public {
        vm.warp(DETECTED);
        registry = new ControllerRegistry();
        journal = new AccessJournal(registry);
        breach = new BreachReport(registry);
        registry.register(ID, WRITER, "Demo One");
    }

    function testOnlyAdminCanRegister() public {
        assert(registry.admin() == address(this));
        vm.expectRevert(ControllerRegistry.NotAdmin.selector);
        vm.prank(WRITER);
        registry.register(keccak256("ctrl:another"), REPLACEMENT, "Another");
    }

    function testOnlyAdminCanRevoke() public {
        vm.expectRevert(ControllerRegistry.NotAdmin.selector);
        vm.prank(WRITER);
        registry.revoke(ID);
    }

    function testRegisterCannotOverwriteAnActiveBinding() public {
        vm.expectRevert(ControllerRegistry.AlreadyActive.selector);
        registry.register(ID, REPLACEMENT, "Replacement");
        assert(registry.isAuthorized(ID, WRITER));
    }

    function testRevokeThenRegisterRotatesKeyAndEmitsBothEvents() public {
        vm.expectEmit(true, true, false, false, address(registry));
        emit ControllerRevoked(ID, WRITER);
        registry.revoke(ID);
        assert(!registry.isAuthorized(ID, WRITER));

        vm.expectEmit(true, true, false, true, address(registry));
        emit ControllerRegistered(ID, REPLACEMENT, "Replacement");
        registry.register(ID, REPLACEMENT, "Replacement");
        assert(registry.isAuthorized(ID, REPLACEMENT));
        assert(!registry.isAuthorized(ID, WRITER));
        (address eoa, bool active) = registry.bindings(ID);
        assert(eoa == REPLACEMENT && active);
    }

    function testAuthorizedAccessAcceptsHighestEventType() public {
        vm.recordLogs();
        _logAs(WRITER, 3);
        TestVm.Log[] memory logs = vm.getRecordedLogs();
        assert(logs.length == 1 && logs[0].emitter == address(journal));
    }

    function testUnauthorizedAccessReverts() public {
        vm.expectRevert(AccessJournal.NotAuthorized.selector);
        _logAs(REPLACEMENT, 0);
    }

    function testRevokedControllerCannotLogAccess() public {
        registry.revoke(ID);
        vm.expectRevert(AccessJournal.NotAuthorized.selector);
        _logAs(WRITER, 0);
    }

    function testAccessEventPayloadAndTopicOrder() public {
        vm.expectEmit(true, true, true, true, address(journal));
        emit AccessLogged(ID, SUBJECT, EVIDENCE, PURPOSE, BASIS, 2, DETECTED);
        vm.recordLogs();
        _logAs(WRITER, 2);
        TestVm.Log[] memory logs = vm.getRecordedLogs();
        assert(logs.length == 1 && logs[0].topics.length == 4);
        assert(logs[0].topics[1] == ID && logs[0].topics[2] == SUBJECT && logs[0].topics[3] == EVIDENCE);
    }

    function testAccessRejectsEventTypeAboveThree() public {
        vm.expectRevert(AccessJournal.InvalidEventType.selector);
        _logAs(WRITER, 4);
    }

    function testOnTimeAnchorEmitsAndStoresTimestamp() public {
        vm.expectEmit(true, true, false, true, address(breach));
        emit BreachAnchored(ID, REPORT, COUNT, DETECTED, DETECTED, DEADLINE);
        _anchor(DETECTED);
        assert(breach.anchoredAt(REPORT) == DETECTED);
    }

    function testAnchorAcceptsExactDeadline() public {
        vm.warp(DEADLINE);
        _anchor(DETECTED);
        assert(breach.anchoredAt(REPORT) == DEADLINE);
    }

    function testAnchorRejectsOneSecondAfterDeadlineWithErrorArgs() public {
        vm.warp(DEADLINE + 1);
        vm.expectRevert(abi.encodeWithSelector(BreachReport.ClaimedWindowExpired.selector, DETECTED, DEADLINE));
        _anchor(DETECTED);
    }

    function testAnchorRejectsFutureBeforeDuplicateAndDeadlineArithmetic() public {
        _anchor(DETECTED);
        vm.expectRevert(BreachReport.DetectedInFuture.selector);
        _anchor(type(uint64).max);
    }

    function testAnchorRejectsDuplicateBeforeWindowCheck() public {
        _anchor(DETECTED);
        vm.warp(DEADLINE + 1);
        vm.expectRevert(BreachReport.AlreadyAnchored.selector);
        _anchor(DETECTED);
    }

    function testLateAnchorRejectsExactDeadline() public {
        vm.warp(DEADLINE);
        vm.expectRevert(BreachReport.NotLate.selector);
        _anchorLate(DETECTED);
    }

    function testLateAnchorEmitsAndStoresOneSecondLate() public {
        vm.warp(DEADLINE + 1);
        vm.expectEmit(true, true, false, true, address(breach));
        emit LateBreachAnchored(ID, REPORT, COUNT, DETECTED, DEADLINE + 1, 1);
        _anchorLate(DETECTED);
        assert(breach.anchoredAt(REPORT) == DEADLINE + 1);
    }

    function testLateAnchorRejectsAlreadyOnTimeReport() public {
        _anchor(DETECTED);
        vm.warp(DEADLINE + 1);
        vm.expectRevert(BreachReport.AlreadyAnchored.selector);
        _anchorLate(DETECTED);
    }

    function testOnTimeAnchorRejectsAlreadyLateReport() public {
        vm.warp(DEADLINE + 1);
        _anchorLate(DETECTED);
        vm.expectRevert(BreachReport.AlreadyAnchored.selector);
        _anchor(DEADLINE + 1);
    }

    function testLateAnchorRejectsFutureBeforeDuplicateAndDeadlineArithmetic() public {
        vm.warp(DEADLINE + 1);
        _anchorLate(DETECTED);
        vm.expectRevert(BreachReport.DetectedInFuture.selector);
        _anchorLate(type(uint64).max);
    }

    function testAnchorChecksAuthorizationBeforeTimestamp() public {
        vm.expectRevert(BreachReport.NotAuthorized.selector);
        vm.prank(REPLACEMENT);
        breach.anchor(ID, REPORT, COUNT, type(uint64).max);
    }

    function testLateAnchorChecksAuthorizationBeforeTimestamp() public {
        registry.revoke(ID);
        vm.expectRevert(BreachReport.NotAuthorized.selector);
        _anchorLate(type(uint64).max);
    }

    function testLatestRepresentableTimestampRemainsOnTimeWithoutOverflow() public {
        uint64 latest = type(uint64).max;
        vm.warp(latest);
        vm.expectRevert(BreachReport.NotLate.selector);
        _anchorLate(latest);
        vm.expectEmit(true, true, false, true, address(breach));
        emit BreachAnchored(ID, REPORT, COUNT, latest, latest, latest);
        _anchor(latest);
        assert(breach.anchoredAt(REPORT) == latest);
    }

    function _logAs(address caller, uint8 eventType) private {
        vm.prank(caller);
        journal.logAccess(ID, SUBJECT, PURPOSE, BASIS, eventType, EVIDENCE);
    }

    function _anchor(uint64 detectedAt) private {
        vm.prank(WRITER);
        breach.anchor(ID, REPORT, COUNT, detectedAt);
    }

    function _anchorLate(uint64 detectedAt) private {
        vm.prank(WRITER);
        breach.anchorLate(ID, REPORT, COUNT, detectedAt);
    }
}

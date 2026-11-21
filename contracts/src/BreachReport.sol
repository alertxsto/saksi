// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ControllerRegistry} from "./ControllerRegistry.sol";

contract BreachReport {
    error NotAuthorized();
    error DetectedInFuture();
    error AlreadyAnchored();
    error ClaimedWindowExpired(uint64 detectedAt, uint64 deadline);
    error NotLate();

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

    uint64 public constant WINDOW = 72 hours;
    mapping(bytes32 => uint64) public anchoredAt;
    ControllerRegistry private immutable registry;

    constructor(ControllerRegistry r) {
        registry = r;
    }

    function anchor(bytes32 controllerId, bytes32 reportHash, bytes32 affectedCountHash, uint64 detectedAt) external {
        uint64 timestamp = _checkAnchor(controllerId, reportHash, detectedAt);
        uint256 deadline = uint256(detectedAt) + WINDOW;
        // Ethereum timestamps are uint64; a deadline beyond their horizon cannot expire.
        uint64 lastOnTime = deadline > type(uint64).max ? type(uint64).max : uint64(deadline);
        if (timestamp > lastOnTime) revert ClaimedWindowExpired(detectedAt, lastOnTime);

        anchoredAt[reportHash] = timestamp;
        emit BreachAnchored(controllerId, reportHash, affectedCountHash, detectedAt, timestamp, lastOnTime);
    }

    function anchorLate(bytes32 controllerId, bytes32 reportHash, bytes32 affectedCountHash, uint64 detectedAt)
        external
    {
        uint64 timestamp = _checkAnchor(controllerId, reportHash, detectedAt);
        uint64 elapsed = timestamp - detectedAt;
        if (elapsed <= WINDOW) revert NotLate();

        anchoredAt[reportHash] = timestamp;
        emit LateBreachAnchored(controllerId, reportHash, affectedCountHash, detectedAt, timestamp, elapsed - WINDOW);
    }

    function _checkAnchor(bytes32 controllerId, bytes32 reportHash, uint64 detectedAt) private view returns (uint64) {
        if (!registry.isAuthorized(controllerId, msg.sender)) revert NotAuthorized();
        if (detectedAt > block.timestamp) revert DetectedInFuture();
        if (anchoredAt[reportHash] != 0) revert AlreadyAnchored();
        return uint64(block.timestamp);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ControllerRegistry} from "./ControllerRegistry.sol";

contract AccessJournal {
    error NotAuthorized();
    error InvalidEventType();

    event AccessLogged(
        bytes32 indexed controllerId,
        bytes32 indexed subjectPseudonym,
        bytes32 indexed evidenceHash,
        bytes32 purposeHash,
        bytes32 legalBasisKey,
        uint8 eventType,
        uint64 timestamp
    );

    ControllerRegistry private immutable registry;

    constructor(ControllerRegistry r) {
        registry = r;
    }

    function logAccess(
        bytes32 controllerId,
        bytes32 subjectPseudonym,
        bytes32 purposeHash,
        bytes32 legalBasisKey,
        uint8 eventType,
        bytes32 evidenceHash
    ) external {
        if (!registry.isAuthorized(controllerId, msg.sender)) revert NotAuthorized();
        if (eventType > 3) revert InvalidEventType();

        emit AccessLogged(
            controllerId, subjectPseudonym, evidenceHash, purposeHash, legalBasisKey, eventType, uint64(block.timestamp)
        );
    }
}

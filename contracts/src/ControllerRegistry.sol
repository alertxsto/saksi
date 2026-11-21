// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract ControllerRegistry {
    error NotAdmin();
    error AlreadyActive();

    event ControllerRegistered(bytes32 indexed controllerId, address indexed eoa, string name);
    event ControllerRevoked(bytes32 indexed controllerId, address indexed eoa);

    struct Binding {
        address eoa;
        bool active;
    }

    address public immutable admin = msg.sender;
    mapping(bytes32 => Binding) public bindings;

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    function register(bytes32 controllerId, address eoa, string calldata name) external onlyAdmin {
        if (bindings[controllerId].active) revert AlreadyActive();
        bindings[controllerId] = Binding(eoa, true);
        emit ControllerRegistered(controllerId, eoa, name);
    }

    function revoke(bytes32 controllerId) external onlyAdmin {
        Binding storage binding = bindings[controllerId];
        binding.active = false;
        emit ControllerRevoked(controllerId, binding.eoa);
    }

    function isAuthorized(bytes32 id, address caller) external view returns (bool) {
        Binding storage binding = bindings[id];
        return binding.active && binding.eoa == caller;
    }
}

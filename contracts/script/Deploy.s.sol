// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ControllerRegistry} from "../src/ControllerRegistry.sol";
import {AccessJournal} from "../src/AccessJournal.sol";
import {BreachReport} from "../src/BreachReport.sol";

interface DeployVm {
    function envAddress(string calldata name) external view returns (address);
    function envOr(string calldata name, address defaultValue) external view returns (address);
    function startBroadcast(address sender) external;
    function stopBroadcast() external;
}

contract Deploy {
    DeployVm private constant vm = DeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    error NotSepolia();
    error InvalidDemoAccounts();

    function run() external returns (ControllerRegistry registry, AccessJournal journal, BreachReport breach) {
        if (block.chainid != 11155111) revert NotSepolia();
        address admin = vm.envAddress("DEPLOY_ADMIN_ADDRESS");
        address one = vm.envAddress("DEMO_CONTROLLER_ONE_ADDRESS");
        address two = vm.envAddress("DEMO_CONTROLLER_TWO_ADDRESS");
        address spare = vm.envOr("DEMO_CONTROLLER_SPARE_ADDRESS", address(0));
        if (admin == address(0) || one == address(0) || two == address(0) || one == two || spare == one || spare == two)
        {
            revert InvalidDemoAccounts();
        }

        vm.startBroadcast(admin);
        registry = new ControllerRegistry();
        journal = new AccessJournal(registry);
        breach = new BreachReport(registry);
        registry.register(keccak256("ctrl:demo-one"), one, "Demo One");
        registry.register(keccak256("ctrl:demo-two"), two, "Demo Two");
        if (spare != address(0)) registry.register(keccak256("ctrl:demo-spare"), spare, "Demo Spare");
        vm.stopBroadcast();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// The contract is handling an airdrop where users pledge Token A to receive Token B based on a conversion ratio.
// It includes phases for pledging and distribution, ensuring fair allocation if the Token B cap is exceeds.
// Security measures like ReentrancyGuard and SafeERC20 are implemented to prevent reentrancy attacks and handle token transfers safely.
// Batch processing is used during distribution to manage large numbers of participants without running into gas limits.


contract Airdrop is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public tokenA;
    IERC20 public tokenB;

    uint256 public conversionRatio;
    uint256 public tokenBMaxCap;
    uint256 public totalPledged;
    uint256 public totalTokenBAllocated;

    address public owner;

    enum AirdropPhase { PLEDGING, DISTRIBUTION, COMPLETED }
    AirdropPhase public currentPhase;

    mapping(address => uint256) public pledgedAmounts;
    mapping(address => uint256) public tokenBAllocation;
    address[] public participants;

    uint256 public processedIndex; // Tracks the number of processed participants.

    event Pledged(address indexed user, uint256 amount);
    event Distributed(address indexed user, uint256 tokenBAmount, uint256 refundedTokenA);
    event PhaseChanged(AirdropPhase newPhase);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    modifier inPhase(AirdropPhase phase) {
        require(currentPhase == phase, "Wrong phase");
        _;
    }

    constructor(
        address _tokenA,
        address _tokenB,
        uint256 _conversionRatio,
        uint256 _tokenBMaxCap
    ) {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
        conversionRatio = _conversionRatio;
        tokenBMaxCap = _tokenBMaxCap;
        owner = msg.sender;
        currentPhase = AirdropPhase.PLEDGING;
    }

    function pledge(uint256 amount) external nonReentrant inPhase(AirdropPhase.PLEDGING) {
        require(amount > 0, "Amount must be greater than 0");

        if (pledgedAmounts[msg.sender] == 0) {
            participants.push(msg.sender);
        }

        tokenA.safeTransferFrom(msg.sender, address(this), amount);
        pledgedAmounts[msg.sender] += amount;
        totalPledged += amount;

        emit Pledged(msg.sender, amount);
    }

    function calculateAllocationsBatch(uint256 batchSize) external onlyOwner nonReentrant inPhase(AirdropPhase.DISTRIBUTION) {
        uint256 scalingFactor = 1e18;
        uint256 totalTokenBNeeded = totalPledged * conversionRatio;

        if (totalTokenBNeeded > tokenBMaxCap) {
            scalingFactor = Math.mulDiv(tokenBMaxCap, 1e18, totalTokenBNeeded);
        }

        uint256 endIndex = Math.min(processedIndex + batchSize, participants.length);
        for (uint256 i = processedIndex; i < endIndex; i++) {
            address user = participants[i];
            uint256 pledged = pledgedAmounts[user];

            uint256 userTokenBNeeded = pledged * conversionRatio;
            uint256 allocatableB = Math.mulDiv(userTokenBNeeded, scalingFactor, 1e18);

            tokenBAllocation[user] = allocatableB;
            totalTokenBAllocated += allocatableB;

            uint256 usedTokenA = allocatableB / conversionRatio;
            uint256 excessTokenA = pledged - usedTokenA;

            if (excessTokenA > 0) {
                tokenA.safeTransfer(user, excessTokenA);
            }

            emit Distributed(user, allocatableB, excessTokenA);
        }

        processedIndex = endIndex;
    }

    function startDistributionPhase() external onlyOwner {
        require(currentPhase == AirdropPhase.PLEDGING, "Phase must be Pledging");
        currentPhase = AirdropPhase.DISTRIBUTION;
        emit PhaseChanged(AirdropPhase.DISTRIBUTION);
    }

    function completeAirdrop() external onlyOwner {
        require(currentPhase == AirdropPhase.DISTRIBUTION, "Phase must be Distribution");
        require(processedIndex == participants.length, "Batch processing not completed");
        currentPhase = AirdropPhase.COMPLETED;
        emit PhaseChanged(AirdropPhase.COMPLETED);
    }
}

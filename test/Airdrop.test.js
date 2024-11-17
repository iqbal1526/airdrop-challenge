const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Airdrop Contract", function () {
  let Airdrop, airdrop;
  let TokenA, tokenA;
  let TokenB, tokenB;
  let owner, user1, user2, user3;
  
  const conversionRatio = 2; // 1 TokenA = 2 TokenB
  const tokenBMaxCap = ethers.utils.parseEther("1000"); // 1000 TokenB max cap

  beforeEach(async () => {
    // Get accounts
    [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy mock TokenA and TokenB
    TokenA = await ethers.getContractFactory("MockERC20");
    tokenA = await TokenA.deploy("TokenA", "TKA", ethers.utils.parseEther("2000")); 
    await tokenA.deployed();

    TokenB = await ethers.getContractFactory("MockERC20");
    tokenB = await TokenB.deploy("TokenB", "TKB", ethers.utils.parseEther("2000"));
    await tokenB.deployed();

    // Distribute TokenA to test users for pledging
    await tokenA.transfer(user1.address, ethers.utils.parseEther("500"));
    await tokenA.transfer(user2.address, ethers.utils.parseEther("500"));
    await tokenA.transfer(user3.address, ethers.utils.parseEther("500"));

    // Deploy Airdrop contract
    Airdrop = await ethers.getContractFactory("Airdrop");
    airdrop = await Airdrop.deploy(tokenA.address, tokenB.address, conversionRatio, tokenBMaxCap);
    await airdrop.deployed();

    // Fund the airdrop contract with TokenB
    await tokenB.transfer(airdrop.address, tokenBMaxCap);
});


  it("should allow users to pledge TokenA and track total pledges", async () => {
    // User1 pledges 100 TokenA
    await tokenA.connect(user1).approve(airdrop.address, ethers.utils.parseEther("100"));
    await airdrop.connect(user1).pledge(ethers.utils.parseEther("100"));

    // Check pledged amount and totalPledged
    expect(await airdrop.pledgedAmounts(user1.address)).to.equal(ethers.utils.parseEther("100"));
    expect(await airdrop.totalPledged()).to.equal(ethers.utils.parseEther("100"));
  });

  it("should calculate and allocate TokenB correctly", async () => {
    // Users pledge TokenA
    await tokenA.connect(user1).approve(airdrop.address, ethers.utils.parseEther("100"));
    await tokenA.connect(user2).approve(airdrop.address, ethers.utils.parseEther("200"));
    await tokenA.connect(user3).approve(airdrop.address, ethers.utils.parseEther("300"));
  
    await airdrop.connect(user1).pledge(ethers.utils.parseEther("100"));
    await airdrop.connect(user2).pledge(ethers.utils.parseEther("200"));
    await airdrop.connect(user3).pledge(ethers.utils.parseEther("300"));
  
    // Move to distribution phase
    await airdrop.startDistributionPhase();
  
    // Calculate allocations with batch processing
    // Assuming there are 3 participants, so batch size is 3
    await airdrop.calculateAllocationsBatch(3);
  
    // Check allocations
    console.log("User1 TokenB:", (await airdrop.tokenBAllocation(user1.address)).toString());
    console.log("User2 TokenB:", (await airdrop.tokenBAllocation(user2.address)).toString());
    console.log("User3 TokenB:", (await airdrop.tokenBAllocation(user3.address)).toString());
  
    // Verify total allocations
    const totalAllocated = await airdrop.totalTokenBAllocated();
    console.log("Total TokenB Allocated:", totalAllocated.toString());
  
    // Check that TokenA refunds are processed correctly
    const user3Refund = await tokenA.balanceOf(user3.address);
    console.log("User3 TokenA Refund:", user3Refund.toString());
  });
  
  it("should handle excess TokenB max cap correctly", async () => {
    // Users pledge more TokenA than TokenB can handle
    await tokenA.connect(user1).approve(airdrop.address, ethers.utils.parseEther("300"));
    await airdrop.connect(user1).pledge(ethers.utils.parseEther("300"));
  
    // Move to distribution phase
    await airdrop.startDistributionPhase();
  
    // Calculate allocations with cap applied using batch processing
    await airdrop.calculateAllocationsBatch(1); // Since only one participant
  
    // Check scaled allocation
    const user1TokenB = await airdrop.tokenBAllocation(user1.address);
    console.log("User1 TokenB after scaling:", user1TokenB.toString());
  
    expect(user1TokenB).to.be.lte(tokenBMaxCap);
  });
  

  it("should allow owner to complete the airdrop", async () => {
    // Complete the airdrop
    await airdrop.startDistributionPhase();
    await airdrop.completeAirdrop();

    // Ensure the phase is COMPLETED
    expect(await airdrop.currentPhase()).to.equal(2); // COMPLETED enum value
  });
});

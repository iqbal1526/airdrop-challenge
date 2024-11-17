const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Airdrop Contract - Batch Processing", function () {
  let Airdrop, airdrop;
  let TokenA, tokenA;
  let TokenB, tokenB;
  let owner, addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8;
  const conversionRatio = 2; // 2 TokenB per 1 TokenA
  const tokenBMaxCap = ethers.utils.parseEther("100"); // Maximum 100 TokenB distributable

  before(async function () {
    [owner, addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8] = await ethers.getSigners();

    TokenA = await ethers.getContractFactory("MockERC20");
    tokenA = await TokenA.deploy("TokenA", "TKA", ethers.utils.parseEther("1000"));
    await tokenA.deployed();

    TokenB = await ethers.getContractFactory("MockERC20");
    tokenB = await TokenB.deploy("TokenB", "TKB", ethers.utils.parseEther("200"));
    await tokenB.deployed();

    Airdrop = await ethers.getContractFactory("Airdrop");
    airdrop = await Airdrop.deploy(
      tokenA.address,
      tokenB.address,
      conversionRatio,
      tokenBMaxCap
    );
    await airdrop.deployed();

    // Distribute some TokenA to participants
    for (let addr of [addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8]) {
      await tokenA.transfer(addr.address, ethers.utils.parseEther("50"));
    }

    // Approve the Airdrop contract for TokenA for all participants
    for (let addr of [addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8]) {
      await tokenA.connect(addr).approve(airdrop.address, ethers.utils.parseEther("50"));
    }

    // Send TokenB to the airdrop contract
    await tokenB.transfer(airdrop.address, ethers.utils.parseEther("100"));
  });

  it("Should allow pledging", async function () {
    await airdrop.connect(addr1).pledge(ethers.utils.parseEther("10"));
    await airdrop.connect(addr2).pledge(ethers.utils.parseEther("15"));
    await airdrop.connect(addr3).pledge(ethers.utils.parseEther("20"));
    await airdrop.connect(addr4).pledge(ethers.utils.parseEther("5"));
    await airdrop.connect(addr5).pledge(ethers.utils.parseEther("30"));
    await airdrop.connect(addr6).pledge(ethers.utils.parseEther("10"));
    await airdrop.connect(addr7).pledge(ethers.utils.parseEther("10"));
    await airdrop.connect(addr8).pledge(ethers.utils.parseEther("20"));

    expect(await airdrop.totalPledged()).to.equal(ethers.utils.parseEther("120"));
  });

  it("Should transition to distribution phase", async function () {
    await airdrop.startDistributionPhase();
    expect(await airdrop.currentPhase()).to.equal(1); // DISTRIBUTION Phase
  });

  it("Should correctly process allocations in batches", async function () {
    // Process the first batch of 4 participants
    await airdrop.calculateAllocationsBatch(4);

    expect(await airdrop.processedIndex()).to.equal(4);

    // Check allocations for the first 4 participants
    const alloc1 = await airdrop.tokenBAllocation(addr1.address);
    const alloc2 = await airdrop.tokenBAllocation(addr2.address);
    const alloc3 = await airdrop.tokenBAllocation(addr3.address);
    const alloc4 = await airdrop.tokenBAllocation(addr4.address);

    expect(alloc1).to.be.gt(0);
    expect(alloc2).to.be.gt(0);
    expect(alloc3).to.be.gt(0);
    expect(alloc4).to.be.gt(0);

    // Process the remaining participants in the second batch
    await airdrop.calculateAllocationsBatch(4);

    expect(await airdrop.processedIndex()).to.equal(8);

    // Check allocations for the remaining participants
    const alloc5 = await airdrop.tokenBAllocation(addr5.address);
    const alloc6 = await airdrop.tokenBAllocation(addr6.address);
    const alloc7 = await airdrop.tokenBAllocation(addr7.address);
    const alloc8 = await airdrop.tokenBAllocation(addr8.address);

    expect(alloc5).to.be.gt(0);
    expect(alloc6).to.be.gt(0);
    expect(alloc7).to.be.gt(0);
    expect(alloc8).to.be.gt(0);

    // Ensure total allocated TokenB respects the max cap
    const totalAllocated = await airdrop.totalTokenBAllocated();
    expect(totalAllocated).to.be.lte(tokenBMaxCap);
  });

  it("Should complete the airdrop", async function () {
    await airdrop.completeAirdrop();
    expect(await airdrop.currentPhase()).to.equal(2); // COMPLETED Phase
  });
});

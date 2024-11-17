require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

module.exports = {
  solidity: "0.8.27",
  networks: {
    hardhat: {},
    sepolia: {
      url: process.env.INFURA_SEPOLIA_URL, // Infura or Alchemy Sepolia URL
      accounts: [process.env.PRIVATE_KEY], // Your wallet private key
    },
  },
};

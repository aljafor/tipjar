const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('TipJar smart contract', function () {
  let contract;


  this.beforeAll(async function () {
    const contractFactory = await ethers.getContractFactory('TipJar');
    contract = await contractFactory.deploy();
    await contract.deployed();
  });


  it('Should deploy the contract and return 0 as totalTips', async function () {
    expect(await contract.totalTips()).to.equal(0);
  });

  it('should allow to send a tip and increase the number', async function () {
    const [, sender] = await ethers.getSigners();
    const senderBalance = await sender.getBalance();

    const tx = await contract.connect(sender).sendTip('message', 'name', { value: ethers.utils.parseEther('0.001') })
    await tx.wait();
    const newSenderBalance = await sender.getBalance();

    expect(tx).changeEtherBalance(contract, ethers.utils.parseEther('0.001'))
    expect(newSenderBalance).to.be.below(senderBalance);
    expect(await contract.totalTips()).to.equal(1);
  })

  it('should return all the tips', async function () {
    const amount = ethers.utils.parseEther('0.002');
    const [, sender] = await ethers.getSigners();
    const tx = await contract
      .connect(sender)
      .sendTip('message 2', 'name 2', { value: amount });

    await tx.wait();

    const tips = await contract.getAllTips();
    expect(await contract.totalTips()).to.equal(2);
    expect(tips.length).to.equal(2);
    expect(tips[1].message).to.equal('message 2');
    expect(tips[1].amount).to.equal(amount);
  });

  it('should fail to send eth bigger than the balance', async function () {
    const [, sender] = await ethers.getSigners();
    const amount = ethers.utils.parseEther('9999');

    const tx = contract
      .connect(sender)
      .sendTip('message 3', 'name 3', { value: amount })

    await expect(tx).to.be.revertedWith("Not enough funds");
  });

  it('should react to the tip event', async function () {
    const [, sender] = await ethers.getSigners();
    const amount = ethers.utils.parseEther('0.1');

    const tx = await contract
      .connect(sender)
      .sendTip('event message', 'event', { value: amount })

    await tx.wait();
    expect(tx).to.emit(contract, 'NewTip').withArgs(sender.address, 'event message', 'event', amount)
  });

  it('should allow the owner to withdraw whole balance', async function () {
    const [owner] = await ethers.getSigners();
    const ownerBalance = await owner.getBalance();
    const contractBalance = await ethers.provider.getBalance(contract.address);
    const tips = await contract.getAllTips();
    const sumTips = tips.reduce((acc, tip) => acc.add(tip.amount), ethers.BigNumber.from(0));
    expect(sumTips).to.be.equal(contractBalance);


    const tx = await contract.connect(owner).withdraw()
    await tx.wait();
    expect(tx).changeEtherBalance(contract, contractBalance.mul(-1));
    expect(tx).changeEtherBalance(owner, contractBalance);

    const newOwnerBalance = await owner.getBalance();
    expect(newOwnerBalance).to.be.above(ownerBalance);

    expect(tx).to.emit(contract, 'NewWithdraw').withArgs(contractBalance)
  });

  it('should reject a withdrawal from another address than the owner', async function () {
    const [, otherUser] = await ethers.getSigners();
    const tx = contract.connect(otherUser).withdraw();
    expect(tx).to.be.revertedWith("Withdraw failure");
  });
})
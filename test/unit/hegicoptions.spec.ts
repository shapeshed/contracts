import {ethers} from "hardhat"
import {BigNumber as BN, Signer} from "ethers"
import {solidity} from "ethereum-waffle"
import chai from "chai"
import {HegicPool} from "../../typechain/HegicPool"
import {HegicOptions} from "../../typechain/HegicOptions"
import {PriceCalculator} from "../../typechain/PriceCalculator"
import {HegicStaking} from "../../typechain/HegicStaking"
import {FakeHegic} from "../../typechain/FakeHegic"
import {FakeUsdc} from "../../typechain/FakeUsdc"
import {FakeWbtc} from "../../typechain/FakeWbtc"
import {FakePriceProvider} from "../../typechain/FakePriceProvider"

chai.use(solidity)
const {expect} = chai

describe("HegicOptions", async () => {
  let hegicPoolWBTC: HegicPool
  let hegicPoolUSDC: HegicPool
  let hegicStakingWBTC: HegicStaking
  let hegicStakingUSDC: HegicStaking
  let hegicOptions: HegicOptions
  let priceCalculator: PriceCalculator
  let fakeHegic: FakeHegic
  let fakeUSDC: FakeUsdc
  let fakeWBTC: FakeWbtc
  let fakePriceProvider: FakePriceProvider
  let deployer: Signer
  let alice: Signer
  let bob: Signer

  beforeEach(async () => {
    ;[deployer, alice, bob] = await ethers.getSigners()

    const fakeHegicFactory = await ethers.getContractFactory("FakeHEGIC")
    fakeHegic = (await fakeHegicFactory.connect(deployer).deploy()) as FakeHegic
    await fakeHegic.deployed()
    await fakeHegic.mintTo(
      await alice.getAddress(),
      await ethers.utils.parseUnits("888000", await fakeHegic.decimals()),
    )

    const fakeUsdcFactory = await ethers.getContractFactory("FakeUSDC")
    fakeUSDC = (await fakeUsdcFactory.connect(deployer).deploy()) as FakeUsdc
    await fakeUSDC.deployed()
    await fakeUSDC.mintTo(
      await alice.getAddress(),
      await ethers.utils.parseUnits("1000000", await fakeUSDC.decimals()),
    )

    const fakeWbtcFactory = await ethers.getContractFactory("FakeWBTC")
    fakeWBTC = (await fakeWbtcFactory.connect(deployer).deploy()) as FakeWbtc
    await fakeWBTC.deployed()
    await fakeWBTC.mintTo(
      await alice.getAddress(),
      await ethers.utils.parseUnits("1000000", await fakeWBTC.decimals()),
    )

    const fakePriceProviderFactory = await ethers.getContractFactory(
      "FakePriceProvider",
    )
    fakePriceProvider = (await fakePriceProviderFactory
      .connect(deployer)
      .deploy(BN.from(50000))) as FakePriceProvider
    await fakePriceProvider.deployed()

    const hegicPoolWBTCFactory = await ethers.getContractFactory("HegicPool")
    hegicPoolWBTC = (await hegicPoolWBTCFactory.deploy(
      await fakeWBTC.address,
      "writeWBTC",
      "wWBTC",
    )) as HegicPool
    await hegicPoolWBTC.deployed()

    const hegicPoolUSDCFactory = await ethers.getContractFactory("HegicPool")
    hegicPoolUSDC = (await hegicPoolUSDCFactory
      .connect(deployer)
      .deploy(await fakeUSDC.address, "writeUSDC", "wUSDC")) as HegicPool
    await hegicPoolUSDC.deployed()

    const hegicStakingWBTCFactory = await ethers.getContractFactory(
      "HegicStaking",
    )
    hegicStakingWBTC = (await hegicStakingWBTCFactory
      .connect(deployer)
      .deploy(
        await fakeHegic.address,
        await fakeWBTC.address,
        "Hegic WBTC Lot",
        "hlWBTC",
      )) as HegicStaking
    await hegicStakingWBTC.deployed()

    const hegicStakingUSDCFactory = await ethers.getContractFactory(
      "HegicStaking",
    )
    hegicStakingUSDC = (await hegicStakingUSDCFactory
      .connect(deployer)
      .deploy(
        await fakeHegic.address,
        await fakeUSDC.address,
        "Hegic USDC Lot",
        "hlUSDC",
      )) as HegicStaking
    await hegicStakingUSDC.deployed()

    const priceCalculatorFactory = await ethers.getContractFactory(
      "PriceCalculator",
    )
    priceCalculator = (await priceCalculatorFactory
      .connect(deployer)
      .deploy(
        [9000, 10000, 20000],
        await fakePriceProvider.address,
        await hegicPoolWBTC.address,
        6,
      )) as PriceCalculator
    await priceCalculator.deployed()

    const hegicOptionsFactory = await ethers.getContractFactory("HegicOptions")
    hegicOptions = (await hegicOptionsFactory
      .connect(deployer)
      .deploy(
        await fakePriceProvider.address,
        await hegicPoolWBTC.address,
        await hegicPoolUSDC.address,
        await hegicStakingUSDC.address,
        await hegicStakingWBTC.address,
        await fakeWBTC.address,
        await fakeUSDC.address,
        "HegicOptions WBTC",
        "HO_WBTC",
      )) as HegicOptions
    await hegicOptions.deployed()

    await hegicPoolWBTC.transferOwnership(await hegicOptions.address)
    await hegicPoolUSDC.transferOwnership(await hegicOptions.address)

    await fakeWBTC
      .connect(alice)
      .approve(await hegicPoolWBTC.address, await ethers.constants.MaxUint256)

    await hegicPoolWBTC
      .connect(alice)
      .provideFrom(
        await alice.getAddress(),
        await ethers.utils.parseUnits("1000000", await fakeWBTC.decimals()),
        true,
        await ethers.utils.parseUnits("1000000", await fakeWBTC.decimals()),
      )

    await fakeUSDC
      .connect(alice)
      .approve(await hegicPoolUSDC.address, await ethers.constants.MaxUint256)

    await hegicPoolUSDC
      .connect(alice)
      .provideFrom(
        await alice.getAddress(),
        await ethers.utils.parseUnits("1000000", await fakeUSDC.decimals()),
        true,
        await ethers.utils.parseUnits("1000000", await fakeUSDC.decimals()),
      )
  })

  describe("constructor & settings", async () => {
    it("should set all initial state", async () => {
      expect(await hegicOptions.priceCalculator()).to.be.eq(
        ethers.constants.AddressZero,
      )
      expect(await hegicOptions.pool(BN.from(1))).to.eq(hegicPoolUSDC.address)
      expect(await hegicOptions.pool(BN.from(2))).to.eq(hegicPoolWBTC.address)
      expect(await hegicOptions.settlementFeeRecipient(BN.from(1))).to.eq(
        hegicStakingUSDC.address,
      )
      expect(await hegicOptions.settlementFeeRecipient(BN.from(2))).to.eq(
        hegicStakingWBTC.address,
      )
      expect(await hegicOptions.token(BN.from(1))).to.eq(fakeUSDC.address)
      expect(await hegicOptions.token(BN.from(2))).to.eq(fakeWBTC.address)
      expect(await hegicOptions.priceProvider()).to.be.eq(
        fakePriceProvider.address,
      )
    })
  })

  describe("transferPoolsOwnership", async () => {
    it("should revert if the caller is not the owner", async () => {
      await expect(
        hegicOptions.connect(alice).transferPoolsOwnership(),
      ).to.be.revertedWith("caller is not the owner")
    })

    it("should revert if it is called after the BETA period", async () => {
      // Move forward 360 days
      await ethers.provider.send("evm_increaseTime", [
        BN.from(31104000).toNumber(),
      ])
      await ethers.provider.send("evm_mine", [])
      await expect(hegicOptions.transferPoolsOwnership()).to.be.reverted
    })

    it("should transfer ownership of the pools", async () => {
      await hegicOptions.transferPoolsOwnership()
      expect(await hegicPoolUSDC.owner()).to.be.eq(await hegicOptions.owner())
      expect(await hegicPoolWBTC.owner()).to.be.eq(await hegicOptions.owner())
    })
  })

  describe("updateSettlementFeeRecipients", async () => {
    it("should revert if the caller is not the owner", async () => {
      await expect(
        hegicOptions
          .connect(alice)
          .updateSettlementFeeRecipients(
            await alice.getAddress(),
            await bob.getAddress(),
          ),
      ).to.be.revertedWith("caller is not the owner")
    })

    it("should revert if zero address is given for recipientPut", async () => {
      await expect(
        hegicOptions.updateSettlementFeeRecipients(
          ethers.constants.AddressZero,
          await bob.getAddress(),
        ),
      ).to.be.reverted
    })

    it("should revert if zero address is given for recipientCall", async () => {
      await expect(
        hegicOptions.updateSettlementFeeRecipients(
          await alice.getAddress(),
          ethers.constants.AddressZero,
        ),
      ).to.be.reverted
    })

    it("should update the settlement fee recipients", async () => {
      await hegicOptions.updateSettlementFeeRecipients(
        await alice.getAddress(),
        await bob.getAddress(),
      )

      expect(await hegicOptions.settlementFeeRecipient(BN.from(1))).to.eq(
        await alice.getAddress(),
      )

      expect(await hegicOptions.settlementFeeRecipient(BN.from(2))).to.eq(
        await bob.getAddress(),
      )
    })
  })

  describe("updatePriceCalculator", async () => {
    it("should revert if the caller is not the owner", async () => {
      await expect(
        hegicOptions
          .connect(alice)
          .updatePriceCalculator(await priceCalculator.address),
      ).to.be.revertedWith("caller is not the owner")
    })

    it("should update the priceCalculator correctly", async () => {
      const priceCalculatorBefore = await hegicOptions.priceCalculator()
      expect(priceCalculatorBefore).to.be.eq(ethers.constants.AddressZero)
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      const priceCalculatorAfter = await hegicOptions.priceCalculator()
      expect(priceCalculatorAfter).to.be.eq(await priceCalculator.address)
    })
  })

  describe("createFor", async () => {
    // TODO test line 130
    it("should revert if the strike is less than 1 day", async () => {
      await expect(
        hegicOptions.createFor(await alice.getAddress(), 1, 1, 1, 1),
      ).to.be.revertedWith("Period is too short")
    })
    it("should revert if the strike is greater than 12 weeks", async () => {
      // Test for 13 weeks
      await expect(
        hegicOptions.createFor(await alice.getAddress(), 7862400, 1, 1, 1),
      ).to.be.revertedWith("Period is too long")
    })
    it("should revert if the option type is not a call or put", async () => {
      await expect(
        hegicOptions.createFor(await alice.getAddress(), 1209600, 1, 1, 0),
      ).to.be.revertedWith("Wrong option type")
    })
    it("should set the strike to the current price if 0 is given", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(await alice.getAddress(), 1209600, 1, 0, 1)
      const option = await hegicOptions.options(BN.from(0))
      expect(option.strike).to.eq(BN.from(50000))
    })
    it("should create a put correctly", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(
        await alice.getAddress(),
        1209600,
        1,
        50000,
        1,
      )
      const option = await hegicOptions.options(BN.from(0))
      expect(option.state).to.eq(BN.from(1))
      expect(option.strike).to.eq(BN.from(50000))
      expect(option.amount).to.eq(BN.from(1))
      // Work out how to test this
      // expect(option.expiration).to.eq(BN.from(1))
      expect(option.optionType).to.eq(BN.from(1))
      expect(option.lockedLiquidityID).to.eq(BN.from(0))
    })

    it("should create a call correctly", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(
        await alice.getAddress(),
        1209600,
        1,
        50000,
        2,
      )
      const option = await hegicOptions.options(BN.from(0))
      expect(option.state).to.eq(BN.from(1))
      expect(option.strike).to.eq(BN.from(50000))
      expect(option.amount).to.eq(BN.from(1))
      // Work out how to test this
      // expect(option.expiration).to.eq(BN.from(1))
      expect(option.optionType).to.eq(BN.from(2))
      expect(option.lockedLiquidityID).to.eq(BN.from(0))
    })

    it("should emit a Create event with correct values", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)

      await expect(
        hegicOptions.createFor(await alice.getAddress(), 1209600, 1, 50000, 2),
      )
        .to.emit(hegicOptions, "Create")
        .withArgs(BN.from(0), await alice.getAddress(), BN.from(0), BN.from(0))
    })
  })

  describe("exercise", async () => {
    it("should revert if the option exerciser is not approved or the owner", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(
        await alice.getAddress(),
        1209600,
        1,
        50000,
        1,
      )

      await expect(
        hegicOptions.connect(bob).exercise(BN.from(0)),
      ).to.be.revertedWith("msg.sender can't exercise this option")
    })

    it("should revert if the option has expired", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(
        await alice.getAddress(),
        1209600,
        1,
        50000,
        1,
      )
      // Move forward 360 days
      await ethers.provider.send("evm_increaseTime", [
        BN.from(31104000).toNumber(),
      ])
      await ethers.provider.send("evm_mine", [])

      await expect(
        hegicOptions.connect(alice).exercise(BN.from(0)),
      ).to.be.revertedWith("Option has expired")
    })

    it("should revert if the option is in the wrong state", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(
        await alice.getAddress(),
        1209600,
        1,
        50000,
        1,
      )
      await expect(hegicOptions.connect(alice).exercise(BN.from(0)))
      await expect(
        hegicOptions.connect(alice).exercise(BN.from(0)),
      ).to.be.revertedWith("Wrong state")
    })

    it("should set the option state to exercised", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(
        await alice.getAddress(),
        1209600,
        1,
        50000,
        1,
      )
      await expect(hegicOptions.connect(alice).exercise(BN.from(0)))
      const option = await hegicOptions.options(BN.from(0))
      expect(option.state).to.eq(BN.from(2))
    })

    xit("should pay any profits", async () => {})

    it("should emit a Exercise event with correct values", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(
        await alice.getAddress(),
        1209600,
        1,
        50000,
        1,
      )

      await expect(hegicOptions.connect(alice).exercise(BN.from(0)))
        .to.emit(hegicOptions, "Exercise")
        .withArgs(BN.from(0), BN.from(0))
    })
  })

  describe("unlock", async () => {
    it("should revert if the option has not expired", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(
        await alice.getAddress(),
        1209600,
        1,
        50000,
        1,
      )

      await expect(hegicOptions.unlock(BN.from(0))).to.be.revertedWith(
        "Option has not expired yet",
      )
    })
    it("should revert if the option is not active", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(
        await alice.getAddress(),
        1209600,
        1,
        50000,
        1,
      )
      // Move forward 360 days
      await ethers.provider.send("evm_increaseTime", [
        BN.from(31104000).toNumber(),
      ])
      await ethers.provider.send("evm_mine", [])
      await hegicOptions.unlock(BN.from(0))
      await expect(hegicOptions.unlock(BN.from(0))).to.be.revertedWith(
        "Option is not active",
      )
    })
    it("should set the option state to Expired", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(
        await alice.getAddress(),
        1209600,
        1,
        50000,
        1,
      )
      // Move forward 360 days
      await ethers.provider.send("evm_increaseTime", [
        BN.from(31104000).toNumber(),
      ])
      await ethers.provider.send("evm_mine", [])
      await hegicOptions.unlock(BN.from(0))
      const option = await hegicOptions.options(BN.from(0))
      expect(option.state).to.eq(BN.from(3))
    })
    xit("should unlock liquidity from the pool", async () => {})
    it("should emit an Expire event with correct values", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(
        await alice.getAddress(),
        1209600,
        1,
        50000,
        1,
      )
      // Move forward 360 days
      await ethers.provider.send("evm_increaseTime", [
        BN.from(31104000).toNumber(),
      ])
      await ethers.provider.send("evm_mine", [])
      await expect(hegicOptions.unlock(BN.from(0)))
        .to.emit(hegicOptions, "Expire")
        .withArgs(BN.from(0))
    })
  })
})

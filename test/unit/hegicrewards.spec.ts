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
import {HegicRewards} from "../../typechain/HegicRewards"

chai.use(solidity)
const {expect} = chai

describe("HegicRewards", async () => {
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
  let hegicRewards: HegicRewards
  let deployer: Signer
  let alice: Signer

  beforeEach(async () => {
    ;[deployer, alice] = await ethers.getSigners()

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
    hegicPoolWBTC = (await hegicPoolWBTCFactory
      .connect(deployer)
      .deploy(await fakeWBTC.address, "writeWBTC", "wWBTC")) as HegicPool
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
    hegicOptions = (await hegicOptionsFactory.deploy(
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
        BN.from(100000),
        true,
        BN.from(100000),
      )

    await fakeUSDC
      .connect(alice)
      .approve(await hegicPoolUSDC.address, await ethers.constants.MaxUint256)

    await hegicPoolUSDC
      .connect(alice)
      .provideFrom(
        await alice.getAddress(),
        BN.from(100000),
        true,
        BN.from(100000),
      )

    const hegicRewardsFactory = await ethers.getContractFactory(
      "HegicWBTCRewards",
    )
    hegicRewards = (await hegicRewardsFactory.deploy(
      await hegicOptions.address,
      await fakeHegic.address,
    )) as HegicRewards
    await hegicRewards.deployed()
  })

  describe("constructor & settings", async () => {
    it("should set all initial state", async () => {
      expect(await hegicRewards.hegicOptions()).to.eq(
        await hegicOptions.address,
      )
      expect(await hegicRewards.hegic()).to.eq(await fakeHegic.address)
      expect(await hegicRewards.rewardsRate()).to.eq(BN.from(10).pow(24))
    })
  })

  describe("setRewardsRate", async () => {
    it("should revert if the caller is not the owner", async () => {
      await expect(
        hegicRewards.connect(alice).setRewardsRate(BN.from(10).pow(10)),
      ).to.be.revertedWith("caller is not the owner")
    })
    it("should revert if the rewards rate is less than MIN_REWARDS_RATE", async () => {
      await expect(hegicRewards.setRewardsRate(BN.from(10).pow(6))).to.be
        .reverted
    })
    it("should revert if the rewards rate is greater than MAX_REWARDS_RATE", async () => {
      await expect(hegicRewards.setRewardsRate(BN.from(10).pow(25))).to.be
        .reverted
    })
    it("should set the rewards rate correctly", async () => {
      const rewardsRateBefore = await hegicRewards.rewardsRate()
      expect(rewardsRateBefore).to.equal(BN.from(10).pow(24))
      await hegicRewards.setRewardsRate(BN.from(10).pow(10))
      const hedgeRewardsAfter = await hegicRewards.rewardsRate()
      expect(hedgeRewardsAfter).to.be.eq(BN.from(10).pow(10))
    })
  })
})

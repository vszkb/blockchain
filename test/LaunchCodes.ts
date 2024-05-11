import { time, loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs'
import { expect } from 'chai'
import hre from 'hardhat'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { ContractTransactionResponse } from 'ethers'
import { LaunchCodes } from '../typechain-types'

/**
 * belépés elfogadása mindkét őr által -> sikeres
 * belépés elfogadása egy őr által -> sikertelen
 * belépés elfogadásának próbája nem őrként -> sikertelen
 * belépés kérelmezése kívülről -> sikeres
 * belépés kérelmezése belülről -> sikertelen
 * belépés úgy, hogy tele van a bázis -> sikertelen
 * 
 * kilépés elfogadása mindkét őr által -> sikeres
 * kilépés kérelmezése belülről -> sikeres
 * kilépés elfogádaása egy őr által -> sikertelen
 * őr kilépés próbálkozása -> sikertelen
 * 
 * teljes őrváltás -> sikeres
 *  őrcsere kérelmezése kívülről -> sikeres
 *  őrcsere elfogadása -> sikeres
 *  belépés kérelmezése az új őr által -> sikeres
 *  sikeres belépés
 *  első őrcsere -> sikeres
 *  első régi őr kilépése -> sikeres
 *  belépés kérelmezése a második új őr által -> sikeres
 *  sikeres belépés
 *  második őrcsere -> sikeres
 *  második régi őr kilépése -> sikeres
 *  őrcsere vége
 * 
 * őrváltás hiba esetén -> sikertelen
 *  3-an vannak bent, sikertelen őrcsere kérelmezése -> sikertelen
 *  őrcsere elutasítása -> sikertelen
 *  első őr belépés után ki aka lépni -> sikertelen
 *  őrcsere közben valaki be akar lépni -> sikertelen
 */

/**
 * typescript interface for the fixture
 */
interface Fixture {
    launchCodes: LaunchCodes & { deploymentTransaction: () => ContractTransactionResponse }
    firstGuard: HardhatEthersSigner
    secondGuard: HardhatEthersSigner
    JoeStaff: HardhatEthersSigner
    BobStaff: HardhatEthersSigner
}

describe('LaunchCodes', () => {
    /**
     * létrehozza a szerződést és ad addresseket a két őrnek és egy staffnak
     * @returns a fixture with the launchCodes contract and the signers
     */
    async function deployLaunchCodesFixture(): Promise<Fixture> {

        const [firstGuard, secondGuard, JoeStaff, BobStaff] = await hre.ethers.getSigners() // 2 őr addresszének lekérése ethereumtól
        if (firstGuard === undefined || secondGuard === undefined || JoeStaff === undefined || BobStaff === undefined) {
            throw new Error('Could not get ethers signers')
        }

        const LaunchCodes = await hre.ethers.getContractFactory('LaunchCodes')
        const launchCodes = await LaunchCodes.deploy(firstGuard.address, secondGuard.address) // 2 őr addresszének átadása a konstruktorba

        return { launchCodes, firstGuard, secondGuard, JoeStaff, BobStaff }
    };

    describe('Entries', () => {
        it('Should let Staff enter', async () => {
            const { launchCodes, firstGuard, secondGuard, JoeStaff } = await loadFixture(deployLaunchCodesFixture);

            await launchCodes.connect(JoeStaff).makeRequest(true);
            await launchCodes.connect(firstGuard).approveEntry(JoeStaff.address);
            await launchCodes.connect(secondGuard).approveEntry(JoeStaff.address);
            await launchCodes.connect(JoeStaff).Enter();

            //0x a hexadecimális formátum miatt kell, amit a log-olt cím nem tartalmaz, de a tesztérték igen
            expect('0x' + (await launchCodes.getLog()).at(0)?.toLowerCase()).to.equal(JoeStaff.address.toLowerCase() + ' entered');
        });

        it('Should revert non guard entry approve', async () => {
            const { launchCodes,  JoeStaff } = await loadFixture(deployLaunchCodesFixture);

            await expect(launchCodes.connect(JoeStaff).approveEntry(JoeStaff.address)).to.be.revertedWith('You are not a guard');
        });

    });


    });


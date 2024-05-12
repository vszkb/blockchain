import { time, loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs'
import { expect } from 'chai'
import hre from 'hardhat'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { ContractTransactionResponse } from 'ethers'
import { LaunchCodes } from '../typechain-types'

/**
 * belépés elfogadása mindkét őr által -> sikeres -
 * belépés elfogadása egy őr által -> sikertelen -
 * belépés elfogadásának próbája nem őrként -> sikertelen -
 * belépés kérelmezése belülről -> sikertelen -
 * kilépési kárelmezés elfogadása belépésként -> sikertelen -
 * belépés úgy, hogy tele van a bázis -> sikertelen -
 * belépés úgy, hogy tele van a bázis -> sikertelen , majd bázis kiürítése, majd belépés -> sikeres -
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

            // joe goes in
            await launchCodes.connect(JoeStaff).makeRequest(true);
            await launchCodes.connect(firstGuard).approveEntry(JoeStaff.address);
            await launchCodes.connect(secondGuard).approveEntry(JoeStaff.address);
            await launchCodes.connect(JoeStaff).Enter();

            //0x a hexadecimális formátum miatt kell, amit a log-olt cím nem tartalmaz, de a tesztérték igen
            await expect('0x' + (await launchCodes.getLog()).at(0)).to.be.equal(JoeStaff.address.toLowerCase() + ' entered');
        });

        it('Should not let Staff enter, only one guard approves', async () => {
            const { launchCodes, firstGuard, JoeStaff } = await loadFixture(deployLaunchCodesFixture);

            // joe wants to go in
            await launchCodes.connect(JoeStaff).makeRequest(true);
            await launchCodes.connect(firstGuard).approveEntry(JoeStaff.address);

            // joe isnt approved by both guards
            await expect(launchCodes.connect(JoeStaff).Enter()).to.be.revertedWith('Request is not approved by both guards');
            await expect(launchCodes.getLog()).to.be.empty;
        });

        it('Should revert non guard entry approve', async () => {
            const { launchCodes, JoeStaff } = await loadFixture(deployLaunchCodesFixture);

            // joes entry request
            await launchCodes.connect(JoeStaff).makeRequest(true);

            // joe tries to approve his own entry
            await expect(launchCodes.connect(JoeStaff).approveEntry(JoeStaff.address)).to.be.revertedWith('You are not a guard');
        });

        it('Should not allow entry requests to be made from inside', async () => {
            const { launchCodes, firstGuard, secondGuard, JoeStaff } = await await loadFixture(deployLaunchCodesFixture);

            // joe goes in
            await launchCodes.connect(JoeStaff).makeRequest(true);
            await launchCodes.connect(firstGuard).approveEntry(JoeStaff.address);
            await launchCodes.connect(secondGuard).approveEntry(JoeStaff.address);
            await launchCodes.connect(JoeStaff).Enter();

            // joe tries to make an entry request from inside
            await launchCodes.connect(JoeStaff).makeRequest(true)
            await expect(launchCodes.connect(firstGuard).approveEntry(JoeStaff.address)).to.be.revertedWith('The requester is already in the building');
        });


        it('Should not allow exit request to be approved as entry', async () => {
            const { launchCodes, firstGuard, JoeStaff } = await await loadFixture(deployLaunchCodesFixture);

            // joe requests to exit
            await launchCodes.connect(JoeStaff).makeRequest(false);

            // guard tries to approve exit as entry
            await expect(launchCodes.connect(firstGuard).approveEntry(JoeStaff.address)).to.be.revertedWith('You can only approve entry requests');
        });

        it('Should not allow entry when facility is full', async () => {
            const { launchCodes, firstGuard, secondGuard, JoeStaff, BobStaff } = await await loadFixture(deployLaunchCodesFixture);

            // joe goes in
            await launchCodes.connect(JoeStaff).makeRequest(true);
            await launchCodes.connect(firstGuard).approveEntry(JoeStaff.address);
            await launchCodes.connect(secondGuard).approveEntry(JoeStaff.address);
            await launchCodes.connect(JoeStaff).Enter();

            // bob wants to go in
            await launchCodes.connect(BobStaff).makeRequest(true);
            await launchCodes.connect(firstGuard).approveEntry(BobStaff.address);
            await launchCodes.connect(secondGuard).approveEntry(BobStaff.address);

            // bob cant go in facility full
            await expect(launchCodes.connect(BobStaff).Enter()).to.be.revertedWith('There are already 3 people in the building');
        });

        it('Should allow entry after facility is empty again', async () => {
            const { launchCodes, firstGuard, secondGuard, JoeStaff, BobStaff } = await await loadFixture(deployLaunchCodesFixture);

            // joe goes in
            await launchCodes.connect(JoeStaff).makeRequest(true);
            await launchCodes.connect(firstGuard).approveEntry(JoeStaff.address);
            await launchCodes.connect(secondGuard).approveEntry(JoeStaff.address);
            await launchCodes.connect(JoeStaff).Enter();

            //bob tries to go in
            await launchCodes.connect(BobStaff).makeRequest(true);
            await launchCodes.connect(firstGuard).approveEntry(BobStaff.address);
            await launchCodes.connect(secondGuard).approveEntry(BobStaff.address);

            // bob cant go in facility full
            await expect(launchCodes.connect(BobStaff).Enter()).to.be.revertedWith('There are already 3 people in the building');

            // joe comes out
            await launchCodes.connect(JoeStaff).makeRequest(false);
            await launchCodes.connect(firstGuard).approveExit(JoeStaff.address);
            await launchCodes.connect(secondGuard).approveExit(JoeStaff.address);
            await launchCodes.connect(JoeStaff).Exit();

            // bob goes in
            await launchCodes.connect(BobStaff).Enter();

            // bob entered log
            await expect('0x' + (await launchCodes.getLog()).at(2)).to.be.equal(BobStaff.address.toLowerCase() + ' entered');
        });

    });


});


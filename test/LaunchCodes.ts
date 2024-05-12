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

    describe('Exits', () => {
        it('Should let staff exit', async () => {
            const { launchCodes, firstGuard, secondGuard, JoeStaff } = await loadFixture(deployLaunchCodesFixture);

            //Joe goes in, to get out
            await launchCodes.connect(JoeStaff).makeRequest(true);
            await launchCodes.connect(firstGuard).approveEntry(JoeStaff.address);
            await launchCodes.connect(secondGuard).approveEntry(JoeStaff.address);
            await launchCodes.connect(JoeStaff).Enter();

            await expect('0x' + (await launchCodes.getLog()).at(0)).to.be.equal(JoeStaff.address.toLowerCase() + ' entered');

            //Joe goes out
            await launchCodes.connect(JoeStaff).makeRequest(false);
            await launchCodes.connect(firstGuard).approveExit(JoeStaff.address);
            await launchCodes.connect(secondGuard).approveExit(JoeStaff.address);
            await launchCodes.connect(JoeStaff).Exit();

            await expect('0x' + (await launchCodes.getLog()).at(1)).to.be.equal(JoeStaff.address.toLowerCase() + ' exited');
        });

        it('Should not let staff exit, only one guard approves', async () => {
            const { launchCodes, firstGuard, secondGuard, JoeStaff } = await loadFixture(deployLaunchCodesFixture);

            //Joe goes in, to get out
            await launchCodes.connect(JoeStaff).makeRequest(true);
            await launchCodes.connect(firstGuard).approveEntry(JoeStaff.address);
            await launchCodes.connect(secondGuard).approveEntry(JoeStaff.address);
            await launchCodes.connect(JoeStaff).Enter();

            //Joe tries to go out
            await launchCodes.connect(JoeStaff).makeRequest(false);
            await launchCodes.connect(firstGuard).approveExit(JoeStaff.address);

            //Joe isnt approved by both guards
            await expect(launchCodes.connect(JoeStaff).Exit()).to.be.revertedWith('Request is not approved by both guards');
            await expect(launchCodes.getLog()).to.be.empty;
        });

        it('Should not allow exit requests to be made from outside', async () => {
            const { launchCodes, firstGuard, JoeStaff } = await loadFixture(deployLaunchCodesFixture);

            //Joe tries to make an exit request from outside
            await launchCodes.connect(JoeStaff).makeRequest(false)
            await expect(launchCodes.connect(firstGuard).approveExit(JoeStaff.address)).to.be.revertedWith('The requester is not in the building');
        });

        it('Should not allow exit request to be approved as entry', async () => {
            const { launchCodes, firstGuard, JoeStaff } = await loadFixture(deployLaunchCodesFixture);
            //Joe requests to exit
            await launchCodes.connect(JoeStaff).makeRequest(false);

            //Guard tries to approve exit as entry
            await expect(launchCodes.connect(firstGuard).approveEntry(JoeStaff.address)).to.be.revertedWith('You can only approve entry requests');
        });

        it('Should not allow guard to exit', async () => {
            const { launchCodes, firstGuard, secondGuard } = await loadFixture(deployLaunchCodesFixture);

            //Guard makes an exit request
            await launchCodes.connect(firstGuard).makeRequest(false);

            await expect(launchCodes.connect(secondGuard).approveExit(firstGuard.address)).to.be.revertedWith('Guards cant exit');
        });
    });

    describe('Shift change', () => {
        it('Should allow full shift change', async () => {
            const { launchCodes, firstGuard, secondGuard, JoeStaff, BobStaff } = await loadFixture(deployLaunchCodesFixture);

            //Joe requests a shift change
            await launchCodes.connect(JoeStaff).requestShiftChange();
            //First guard approves
            await launchCodes.connect(firstGuard).approveShiftChange();

            //Check if shift change started
            await expect((await launchCodes.getLog()).at(0)).to.be.equal('Shift change started');
            
            //Guards approve the entry
            await launchCodes.connect(firstGuard).approveEntry(JoeStaff.address);
            await launchCodes.connect(secondGuard).approveEntry(JoeStaff.address);
            //Joe enters
            await launchCodes.connect(JoeStaff).Enter();

            //Check if Joe entered
            await expect('0x' + (await launchCodes.getLog()).at(1)).to.be.equal(JoeStaff.address.toLowerCase() + ' entered');
            
            //First guard completes the shift change
            await launchCodes.connect(firstGuard).completeShiftChange();

            //Check if switch happened
            await expect((await launchCodes.getLog()).at(2)).to.be.equal('First guard changed');

            //First guard makes an exit request
            await launchCodes.connect(firstGuard).makeRequest(false);
            //The guards with JoeStaff as new approve the exit
            await launchCodes.connect(JoeStaff).approveExit(firstGuard.address);
            await launchCodes.connect(secondGuard).approveExit(firstGuard.address);
            //First guard exits
            await launchCodes.connect(firstGuard).Exit();

            //Check if first guard exited
            await expect('0x' + (await launchCodes.getLog()).at(3)).to.be.equal(firstGuard.address.toLowerCase() + ' exited');

            //Bob requests a shift change
            await launchCodes.connect(BobStaff).requestShiftChange();
            //Second guard approves
            await launchCodes.connect(secondGuard).approveShiftChange();

            //Guards approve the entry
            await launchCodes.connect(JoeStaff).approveEntry(BobStaff.address);
            await launchCodes.connect(secondGuard).approveEntry(BobStaff.address);
            //Bob enters
            await launchCodes.connect(BobStaff).Enter();

            //Check if Bob entered
            await expect('0x' + (await launchCodes.getLog()).at(4)).to.be.equal(BobStaff.address.toLowerCase() + ' entered');

            //Second guard completes the shift change
            await launchCodes.connect(secondGuard).completeShiftChange();

            //Check if switch happened
            await expect((await launchCodes.getLog()).at(5)).to.be.equal('Second guard changed');

            //Second guard makes an exit request
            await launchCodes.connect(secondGuard).makeRequest(false);
            //The guards with BobStaff as new approve the exit
            await launchCodes.connect(JoeStaff).approveExit(secondGuard.address);
            await launchCodes.connect(BobStaff).approveExit(secondGuard.address);
            //Second guard exits
            await launchCodes.connect(secondGuard).Exit();

            //Check if second guard exited
            await expect('0x' + (await launchCodes.getLog()).at(6)).to.be.equal(secondGuard.address.toLowerCase() + ' exited');
            //Check if shift change ended
            await expect((await launchCodes.getLog()).at(7)).to.be.equal('Shift change ended');
        });

        it('Should not approve shift change request when facility is full', async () => {
            const { launchCodes, firstGuard, secondGuard, JoeStaff, BobStaff } = await loadFixture(deployLaunchCodesFixture);

            //Joe goes in
            await launchCodes.connect(JoeStaff).makeRequest(true);
            await launchCodes.connect(firstGuard).approveEntry(JoeStaff.address);
            await launchCodes.connect(secondGuard).approveEntry(JoeStaff.address);
            await launchCodes.connect(JoeStaff).Enter();

            //Check if Joe entered
            await expect('0x' + (await launchCodes.getLog()).at(0)).to.be.equal(JoeStaff.address.toLowerCase() + ' entered');

            //Joe requests a shift change
            await launchCodes.connect(BobStaff).requestShiftChange();
            //First guard approves
            await expect(launchCodes.connect(firstGuard).approveShiftChange()).to.be.revertedWith('There is 3 people in the building');
        });

        it('Should not let another guard approve the shift change', async () => {
            const { launchCodes, secondGuard, JoeStaff } = await loadFixture(deployLaunchCodesFixture);

            //Joe requests a shift change
            await launchCodes.connect(JoeStaff).requestShiftChange();
            //First guard approves
            await expect(launchCodes.connect(secondGuard).approveShiftChange()).to.be.revertedWith('You cant approve shift change');
        });

        it('Should not let staff inside request shift change', async () => {
            const { launchCodes, firstGuard } = await loadFixture(deployLaunchCodesFixture);

            //Joe requests a shift change
            await expect(launchCodes.connect(firstGuard).requestShiftChange()).to.be.revertedWith('You are in the building');
        });

        it('Should only complete approved shift change', async () => {
            const { launchCodes, firstGuard, JoeStaff } = await loadFixture(deployLaunchCodesFixture);

            //Joe requests a shift change
            await launchCodes.connect(JoeStaff).requestShiftChange();

            //First guard completes the shift change
            await expect(launchCodes.connect(firstGuard).completeShiftChange()).to.be.revertedWith('Shift change is not approved');
        });

        it('Should only complete shift change when both participants are inside', async () => {
            const { launchCodes, firstGuard, JoeStaff } = await loadFixture(deployLaunchCodesFixture);

            //Joe requests a shift change
            await launchCodes.connect(JoeStaff).requestShiftChange();
            //First guard approves
            await launchCodes.connect(firstGuard).approveShiftChange();

            //First guard completes the shift change
            await expect(launchCodes.connect(firstGuard).completeShiftChange()).to.be.revertedWith('The new guard is not in the building');
        });
    });

    describe('OnlyGuard actions', () => {
        it('Should only allow guards to call approveEntry', async () => {
            const { launchCodes, JoeStaff } = await loadFixture(deployLaunchCodesFixture);

            await launchCodes.connect(JoeStaff).makeRequest(true);
            await expect(launchCodes.connect(JoeStaff).approveEntry(JoeStaff.address)).to.be.revertedWith('You are not a guard');
        });

        it('Should only allow guards to call approveExit', async () => {
            const { launchCodes, JoeStaff } = await loadFixture(deployLaunchCodesFixture);

            await launchCodes.connect(JoeStaff).makeRequest(true);
            await expect(launchCodes.connect(JoeStaff).approveExit(JoeStaff.address)).to.be.revertedWith('You are not a guard');
        });

        it('Should only allow guards to call approveShiftChange', async () => {
            const { launchCodes, JoeStaff } = await loadFixture(deployLaunchCodesFixture);

            await expect(launchCodes.connect(JoeStaff).approveShiftChange()).to.be.revertedWith('You are not a guard');
        });

        it('Should only allow guards to call completeShiftChange', async () => {
            const { launchCodes, JoeStaff } = await loadFixture(deployLaunchCodesFixture);

            await expect(launchCodes.connect(JoeStaff).completeShiftChange()).to.be.revertedWith('You are not a guard');
        });
    });

});


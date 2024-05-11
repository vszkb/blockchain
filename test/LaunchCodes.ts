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


describe('LaunchCodes', () => {

});


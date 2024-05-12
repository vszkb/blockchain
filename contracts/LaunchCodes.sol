pragma solidity ^0.8.24;

contract LaunchCodes {
    address public firstGuard;
    address public secondGuard;
    address[] public staff;
    string[] public log;

    bool public isShiftChangeInProgress = false;
    bool public lastChangeWasFirstGuard = false;
    bool public isDoorOpen = false;

    mapping (address => request) addressToRequest;
    shiftChangeRequest public actualShiftChangeRequest; 
    
    struct request {
        address requester;
        bool isEntry;
        bool isApprovedByFirstGuard;
        bool isApprovedBySecondGuard;
    }

    struct shiftChangeRequest {
        address oldGuard;
        address newGuard;
        bool isApproved;
    }

    constructor(address _firstGuard, address _secondGuard) {
        firstGuard = _firstGuard;
        secondGuard = _secondGuard;

        staff.push(firstGuard);
        staff.push(secondGuard);
    }

    modifier onlyGuard() {
        require(msg.sender == firstGuard || msg.sender == secondGuard, "You are not a guard");
        _;
    }

    modifier approvedRequest() {
        require(addressToRequest[msg.sender].isApprovedByFirstGuard && addressToRequest[msg.sender].isApprovedBySecondGuard, "Request is not approved by both guards");
        _;
    }

    /**
     * Be- vagy kilépési kérelem létrehozása
     * @param _isEntry belépés esetén true, kilépés esetén false
     */
    function makeRequest(bool _isEntry) external {
        addressToRequest[msg.sender] = request(msg.sender, _isEntry, false, false);
    }

    /**
     * Belépési kérelem elfogadása, ha:
     * - a kérelem belépési kérelem
     * - a kérelmező nincs még bent
     * @param _requester a kérelmező címe
     */
    function approveEntry(address _requester) external onlyGuard {
        require(addressToRequest[_requester].isEntry, "You can only approve entry requests");
        require(!checkPersonInFacility(_requester), "The requester is already in the building");

        if (msg.sender == firstGuard) {
            addressToRequest[_requester].isApprovedByFirstGuard = true;
        } else {
            addressToRequest[_requester].isApprovedBySecondGuard = true;
        }
    }

    /**
     * Kilépési kérelem elfogadása, ha:
     * - a kérelem kilépési kérelem
     * - a kérelmező bent van
     * - a kérelmező nem őr
     * @param _requester a kérelmező címe
     */
    function approveExit(address _requester) external onlyGuard {
        require(!addressToRequest[_requester].isEntry, "You can only approve exit requests");
        require(_requester != firstGuard && _requester != secondGuard, "Guards cant exit");
        require(checkPersonInFacility(_requester), "The requester is not in the building");

        if (msg.sender == firstGuard) { //Hívó alapján jegyezzük fel, hogy melyik őr fogadta
            addressToRequest[_requester].isApprovedByFirstGuard = true;
        } else {
            addressToRequest[_requester].isApprovedBySecondGuard = true;
        }
    }

    /**
     * Beléptetés, ha:
     * - nincs 3 ember bent
     * - rendelkezik a kérelmező elfogadott belépési kérelemmel
     * - shift change esetében csak a leváltó őr léphet be
     */
    function Enter() external approvedRequest {
        require (staff.length < 3, "There are already 3 people in the building");
        if (isShiftChangeInProgress) {
            require(msg.sender == actualShiftChangeRequest.newGuard, "You can't enter during a shift change");
        }

        toggleDoor(true); 
        staff.push(msg.sender);
        toggleDoor(false);

        log.push(string.concat(toAsciiString(msg.sender), " entered"));
        delete addressToRequest[msg.sender];
    }

    /**
     * Kiléptetés, ha:
     * - rendelkezik a kérelmező elfogadott kilépési kérelemmel
     */
    function Exit() external approvedRequest {
        //shift change-nél a leváltó őr nem tud kimenni leváltás nélkül (biztosra megy)
        if (isShiftChangeInProgress) {
            require (msg.sender != actualShiftChangeRequest.newGuard, "You can't exit without shift change");
        }

        toggleDoor(true);
        removeFromStaff(msg.sender);
        toggleDoor(false);

        log.push(string.concat(toAsciiString(msg.sender), " exited"));
        delete addressToRequest[msg.sender];

        //ha megtörtént a második őr leváltása is, akkor lezárjuk a shift change-t
        if (isShiftChangeInProgress && !lastChangeWasFirstGuard) {
            isShiftChangeInProgress = false;
            delete actualShiftChangeRequest;
            log.push("Shift change ended");
        }
    }

    /**
     * @param _toOpen true esetén nyit, false esetén zár
     */
    function toggleDoor(bool _toOpen) internal {
        isDoorOpen = _toOpen;
    }

    /**
     * Visszaadja az ajtó állapotát
     */
    function getDoorStatus() external view returns (bool) {
        return isDoorOpen;
    }

    /**
     * Shift change kérelem létrehozása
     * - csak kívülről lehet shift change-t kérni
     * - a kérelem elfogadásáig nem indul el a folyamat
     */
    function requestShiftChange() external {
        //csak kívülről lehet shift change-t kérni
        require (!checkPersonInFacility(msg.sender), "You are in the building");

        if (!lastChangeWasFirstGuard) { //Minden szolgálatváltáskor először az elsőt, majd a második őrt váltjuk le
            actualShiftChangeRequest = shiftChangeRequest(firstGuard, msg.sender, false);
        } else {
            actualShiftChangeRequest = shiftChangeRequest(secondGuard, msg.sender, false);
        }
    }

    /**
     * Shift change kérelem elfogadása, melyet csak a leváltásra kijelölt őr tud elvégezni
     * - kérelem elfogadásával elindul a shift change
     * - a leváltó őr beléptetése elindul, ezzel ugyanúgy kell eljárnia mint sima belépésnél
     */
    function approveShiftChange() external onlyGuard {
        require (msg.sender == actualShiftChangeRequest.oldGuard, "You cant approve shift change");
        require (staff.length < 3, "There is 3 people in the building");

        actualShiftChangeRequest.isApproved = true;
        isShiftChangeInProgress = true;
        if(!lastChangeWasFirstGuard){
            log.push("Shift change started");
        }
        
        addressToRequest[actualShiftChangeRequest.newGuard] = request(actualShiftChangeRequest.newGuard, true, false, false);
    }

    /**
     * Őr leváltási folyamat
     * - csak a leváltásra kijelölt őr tudja végbevinni, ezzel is biztosítva, hogy a cserében résztvevő mindkét fél "akarja" azt, hisz a folyamatot a másik fél kezdeményezte
     */
    function completeShiftChange() external onlyGuard {
        require (actualShiftChangeRequest.isApproved, "Shift change is not approved");
        require (checkPersonInFacility(actualShiftChangeRequest.newGuard), "The new guard is not in the building");

        if (!lastChangeWasFirstGuard && actualShiftChangeRequest.oldGuard == firstGuard) {
            firstGuard = actualShiftChangeRequest.newGuard;
            lastChangeWasFirstGuard = true;
            log.push("First guard changed");
        } else if (lastChangeWasFirstGuard && actualShiftChangeRequest.oldGuard == secondGuard) {
            secondGuard = actualShiftChangeRequest.newGuard;
            lastChangeWasFirstGuard = false;
            log.push("Second guard changed");
        }
    }


    /**
     * @param _address megnézi, hogy a keresett című személy bent van-e a staff listában
     */
    function checkPersonInFacility (address _address) internal view returns (bool) {
        for (uint i = 0; i < staff.length; i++) {
            if (staff[i] == _address) {
                return true;
            }
        }
        return false;
    }

    /**
     * @param _address kitörli a staff listából a keresett című személyt
     */
    function removeFromStaff (address _address) internal {
        for (uint i = 0; i < staff.length; i++) {
            if (staff[i] == _address) {
                staff[i] = staff[staff.length - 1];
                staff.pop();
            }
        }
    }

    function getLog() external view returns (string[] memory) {
        return log;
    }

    /**
     * Forrás: https://ethereum.stackexchange.com/questions/8346/convert-address-to-string
     * Felhasználás ideje: 2024.05.11.
     * 
     * Segít addrest string-gé alakítani a logoláshoz
     * @param x address
     */
    function toAsciiString(address x) internal pure returns (string memory) {
        bytes memory s = new bytes(40);
        for (uint i = 0; i < 20; i++) {
            bytes1 b = bytes1(uint8(uint(uint160(x)) / (2**(8*(19 - i)))));
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            s[2*i] = char(hi);
            s[2*i+1] = char(lo);            
        }
        return string(s);
    }

    /**
     * Forrás: https://ethereum.stackexchange.com/questions/8346/convert-address-to-string
     * Felhasználás ideje: 2024.05.11.
     */
    function char(bytes1 b) internal pure returns (bytes1 c) {
        if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
        else return bytes1(uint8(b) + 0x57);
    }
    
}
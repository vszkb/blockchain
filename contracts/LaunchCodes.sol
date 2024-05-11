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
     * be vagy kilépési kérés létrehozása, mapbe elmenteni
     * kivűlről ne lehessen kimenőt kérni, belülről meg bemenőt
     */
    function makeRequest(bool _isEntry) external {
        addressToRequest[msg.sender] = request(msg.sender, _isEntry, false, false);
    }

    /**
     * csak kívülről lehet belépni
     * minden belépést mindkét őrnek engedélyezni kell
     */
    function approveEntry(address _requester) external onlyGuard {
        require(addressToRequest[_requester].isEntry, "You can only approve entry requests");
        require(!checkPersonInFacility(_requester), "The requester is already in the building"); //őrök bent vannak, ezért ez kiszűri őket

        if (msg.sender == firstGuard) {
            addressToRequest[_requester].isApprovedByFirstGuard = true;
        } else {
            addressToRequest[_requester].isApprovedBySecondGuard = true;
        }
    }

    /**
     * csak belülről lehet kilépni
     * minden kilépést mindkét őrnek engedélyezni kell
     * őrök nem léphetnek ki
     */
    function approveExit(address _requester) external onlyGuard {
        require(!addressToRequest[_requester].isEntry, "You can only approve exit requests");
        require(_requester != firstGuard || _requester != secondGuard, "Guards can't exit");
        require(checkPersonInFacility(_requester), "The requester is not in the building");

        if (msg.sender == firstGuard) {
            addressToRequest[_requester].isApprovedByFirstGuard = true;
        } else {
            addressToRequest[_requester].isApprovedBySecondGuard = true;
        }
    }

    /**
     * shift change-nél nem lehet belépni, kivéve a shiftchangerequest-ező
     * 3-nál többen nem lehetnek bent
     * megnézi, hogy a requestet mindkét őr elfogadta-e
     * ajtót nyit, csuk
     * staff-be belerak
     * logolni kell
     * request törlése
     */
    function Enter() external approvedRequest {
        require (staff.length < 3, "There are already 3 people in the building");
        if (isShiftChangeInProgress) {
            require(msg.sender == actualShiftChangeRequest.newGuard, "You can't enter during a shift change");
        }

        isDoorOpen = true;
        staff.push(msg.sender);
        isDoorOpen = false;
        log.push(string.concat(toAsciiString(msg.sender), " entered"));
        delete addressToRequest[msg.sender];
    }

    /**
     * megnézi, hogy a requestet mindkét őr elfogadta-e
     * ajtót nyit
     * staff-ból kivesz
     * logolni kell
     * request törlése
     * shiftchange végét beállítja, ha utoljára második őr volt cserélve és eddig shiftchange volt
     */
    function Exit() external approvedRequest {
        //shift change-nél, ha az új nem tud kimenni váltás nélkül (biztosra megy)
        if (isShiftChangeInProgress) {
            require (msg.sender != actualShiftChangeRequest.newGuard, "You can't exit without shift change");
        }

        isDoorOpen = true;
        removeFromStaff(msg.sender);
        isDoorOpen = false;
        log.push(string.concat(toAsciiString(msg.sender), " exited"));
        delete addressToRequest[msg.sender];

        if (isShiftChangeInProgress && !lastChangeWasFirstGuard) {
            isShiftChangeInProgress = false;
            delete actualShiftChangeRequest;
            log.push("Shift change ended");
        }
    }

    /**
     * létrejön egy shiftchange request
     * létrejön egy belépő request is
     */
    function requestShiftChange() external {
        //csak kívülről lehet shift change-t kérni
        require (!checkPersonInFacility(msg.sender), "You are in the building");

        if (!lastChangeWasFirstGuard) {
            actualShiftChangeRequest = shiftChangeRequest(msg.sender, firstGuard, false);
        } else {
            actualShiftChangeRequest = shiftChangeRequest(msg.sender, secondGuard, false);
        }
    }

    /**
     * elég annak az őrnek elfogadnia, akivivel cserél
     * elindul a shift change
     * csere után belépési request-et csinálunk a kérelmezőnek
     */
    function approveShiftChange() external onlyGuard {
        require (msg.sender == actualShiftChangeRequest.oldGuard, "You can't approve shift change");

        actualShiftChangeRequest.isApproved = true;
        isShiftChangeInProgress = true;
        log.push("Shift change started");

        addressToRequest[actualShiftChangeRequest.newGuard] = request(actualShiftChangeRequest.newGuard, true, false, false);
    }

    /**
     * lecseréli a régebben cserélt őrt, ha elfogadták a cserét
     * az új őrnek már be kellett lépnie
     */
    function completeShiftChange() external onlyGuard {
        require (actualShiftChangeRequest.isApproved, "Shift change is not approved");
        require (checkPersonInFacility(actualShiftChangeRequest.newGuard), "The new guard is not in the building");

        if (!lastChangeWasFirstGuard && actualShiftChangeRequest.oldGuard == firstGuard) {
            firstGuard = actualShiftChangeRequest.newGuard;
            lastChangeWasFirstGuard = true;
        } else if (lastChangeWasFirstGuard && actualShiftChangeRequest.oldGuard == secondGuard) {
            secondGuard = actualShiftChangeRequest.newGuard;
            lastChangeWasFirstGuard = false;
        }
    }

    function getLog() external view returns (string[] memory) {
        return log;
    }

    /**
     * megnézi, hogy az adott című személy bent van-e a staff-ban
     * @param _address keresett cím
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
     * kiveszi az adott című személyt a staff-ból
     * @param _address keresett cím
     */
    function removeFromStaff (address _address) internal {
        for (uint i = 0; i < staff.length; i++) {
            if (staff[i] == _address) {
                staff[i] = staff[staff.length - 1];
                staff.pop();
            }
        }
    }

    /**
     * forrás: https://ethereum.stackexchange.com/questions/8346/convert-address-to-string
     * felhasználás ideje: 2024.05.11.
     * 
     * segít addrest string-gé alakítani a logoláshoz
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
     * forrás: https://ethereum.stackexchange.com/questions/8346/convert-address-to-string
     * felhasználás ideje: 2024.05.11.
     */
    function char(bytes1 b) internal pure returns (bytes1 c) {
        if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
        else return bytes1(uint8(b) + 0x57);
    }
    
}
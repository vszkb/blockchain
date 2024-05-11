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
        bool isApproovedByFirstGuard;
        bool isApproovedBySecondGuard;
    }

    struct shiftChangeRequest {
        address oldGuard;
        address newGuard;
        bool isApprooved;
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

    modifier approovedRequest() {
        require(addressToRequest[msg.sender].isApproovedByFirstGuard && addressToRequest[msg.sender].isApproovedBySecondGuard, "Request is not approoved by both guards");
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
     * minden belépést mindkét őrnek engedélyezni kell
     */
    function approoveEntry(address _requester) external onlyGuard {
        require(addressToRequest[_requester].isEntry, "You can only approove entry requests");
        //guardok bent vannak, ezért ez kiszűri őket
        require(!checkPersonInFacility(_requester), "The requester is already in the building");

        if (msg.sender == firstGuard) {
            addressToRequest[_requester].isApproovedByFirstGuard = true;
        } else {
            addressToRequest[_requester].isApproovedBySecondGuard = true;
        }
    }

    /**
     * minden kilépést mindkét őrnek engedélyezni kell
     */
    function approoveExit(address _requester) external onlyGuard {
        require(!addressToRequest[_requester].isEntry, "You can only approove exit requests");
        require(_requester != firstGuard || _requester != secondGuard, "Guards can't exit");
        require(checkPersonInFacility(_requester), "The requester is not in the building");

        if (msg.sender == firstGuard) {
            addressToRequest[_requester].isApproovedByFirstGuard = true;
        } else {
            addressToRequest[_requester].isApproovedBySecondGuard = true;
        }
    }

    /**
     * shift changenel sem lephet be tobb, kivéve shiftchangerequest-ező
     * megnézi, hogy a requestet mindkét őr elfogadta-e
     * logolni kell
     * request törlése
     */
    function Enter() external approovedRequest {
        require (staff.length < 3, "There are already 3 people in the building");
        if (isShiftChangeInProgress) {
            require(msg.sender == actualShiftChangeRequest.newGuard, "You can't enter during a shift change");
        }

        isDoorOpen = true;
        staff.push(msg.sender);
        isDoorOpen = false;
        log.push(string(abi.encodePacked(msg.sender, " entered")));
        delete addressToRequest[msg.sender];
    }

    /**
     * shiftchange végét beállítja, ha utoljára második guard volt cserélve és eddig shiftchange volt
     * megnézi, hogy a requestet mindkét őr elfogadta-e
     * logolni kell
     * request törlése
     */
    function Exit() external approovedRequest {
        //shift change-nél, ha az új őr még váltás előtt ki akarna menni
        if (isShiftChangeInProgress) {
            require( msg.sender != actualShiftChangeRequest.newGuard, "You can't exit without shift change");
        }

        isDoorOpen = true;
        removeFromStaff(msg.sender);
        isDoorOpen = false;
        log.push(string(abi.encodePacked(msg.sender, " exited")));
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
     * guard aki cserél elfogadja és végbemegy a cseréje
     * bool alapján nézzük, hogy melyik guardot kell cserélni, és hogy az is hívta-e meg
     * csere után csinálunk a régi guardnak (aki ezt meghívta) egy exit request
     */
    function approoveShiftChange() external onlyGuard {
        require (msg.sender == actualShiftChangeRequest.oldGuard, "You can't approove shift change");

        actualShiftChangeRequest.isApprooved = true;
        isShiftChangeInProgress = true;
        log.push("Shift change started");

        addressToRequest[msg.sender] = request(msg.sender, true, false, false);
    }

    function completeShiftChange() external onlyGuard {
        require (actualShiftChangeRequest.isApprooved, "Shift change is not approoved");
        require (checkPersonInFacility(actualShiftChangeRequest.newGuard), "The new guard is not in the building");

        if (!lastChangeWasFirstGuard && actualShiftChangeRequest.oldGuard == firstGuard) {
            firstGuard = actualShiftChangeRequest.newGuard;
            lastChangeWasFirstGuard = !lastChangeWasFirstGuard;
        } else if (lastChangeWasFirstGuard && actualShiftChangeRequest.oldGuard == secondGuard) {
            secondGuard = actualShiftChangeRequest.newGuard;
            lastChangeWasFirstGuard = !lastChangeWasFirstGuard;
        }
    }

    function checkPersonInFacility (address _address) internal view returns (bool) {
        for (uint i = 0; i < staff.length; i++) {
            if (staff[i] == _address) {
                return true;
            }
        }
        return false;
    }

    function removeFromStaff (address _address) internal {
        // for (uint i = 0; i < staff.length; i++) {
        //     if (staff[i] == _address) {
        //         staff[i] = staff[staff.length - 1];
        //         staff.pop();
        //     }
        // }
    }
    
}
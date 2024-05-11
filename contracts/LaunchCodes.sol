pragma solidity ^0.8.24;

contract LaunchCodes {
    address public firstGuard;
    address public secondGuard;
    address[] public staff;
    string[] public log;
    bool public isShiftChangeInProgress;
    bool public lastChangeWasFirstGuard;

    mapping (address => request) addressToRequest;
    shiftChangeRequest public actualShiftChaneRequest; 
    
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

    }

    /**
     * minden belépést mindkét őrnek engedélyezni kell
     */
    //
    function approoveEntry() external onlyGuard {

    }

    /**
     * minden kilépést mindkét őrnek engedélyezni kell
     */
    function approoveExit() external onlyGuard {

    }

    /**
     * ha hárman vannak több nem léphet be
     * shift changenel sem lephet be tobb, kivéve shiftchangerequest-ező
     * megnézi, hogy a requestet mindkét őr elfogadta-e
     * logolni kell
     * request törlése
     */
    function Enter() external approovedRequest {

    }

    /**
     * shiftchange végét beállítja, ha utoljára második guard volt cserélve és eddig shiftchange volt
     * guard on duty nem léphet ki
     * megnézi, hogy a requestet mindkét őr elfogadta-e
     * logolni kell
     * request törlése
     */
    function Exit() external approovedRequest {

    }

    /**
     * létrejön egy shiftchange request
     * létrejön egy belépő request is
     */
    function requestShiftChange() external {


    }

    /**
     *  guard aki cserél elfogadja és végbemegy a cseréje
     * bool alapján nézzük, hogy melyik guardot kell cserélni, és hogy az is hívta-e meg
     * csere után csinálunk a régi guardnak (aki ezt meghívta) egy exit request
     */
    function approoveShiftChange() external onlyGuard {
        firstGuard


    }


    
}
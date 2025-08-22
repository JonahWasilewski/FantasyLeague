// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract FantasyLeague is ReentrancyGuard, Ownable, AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    uint256 public entryFee;
    uint256 public maxTeamBudget = 100_000_000;

    uint8 public maxNameLength = 32;
    uint8 public maxTeamNameLength = 32;

    // participation tracking
    address[] public participants;
    mapping(address => bool) public hasJoined;

    // display names
    mapping(address => string) public playerNames;
    mapping(address => string) public teamNames;
    mapping(bytes32 => bool) private teamNameTaken;
    mapping(uint256 => uint256) public playerSelectionCount;

    // --- DATA STRUCTURES ---
    struct Player {
        uint256 id;
        string name;
        string rawStats;
        uint256 price;
    }

    // full player data
    mapping(uint256 => Player) public players;
    // map keccak256(name) to playerId
    mapping(bytes32 => uint256) public nameToId;
    uint256[] public           playerIds;
    mapping(uint256 => bool)   public tracked;

    // a counter for new players
    uint256 public nextPlayerId = 1;

    // fantasy team per user
    struct FantasyTeam { uint256[] playerIds; bool submitted; uint256 captain; }
    mapping(address => FantasyTeam) public userTeams;

    // leaderboard
    mapping(address => uint256) public userRank;
    address[] public              leaderboard;

    // season archival
    uint256 public currentSeason = 1;
    mapping(uint256 => address[])                         public pastParticipants;
    mapping(uint256 => mapping(address => FantasyTeam))   public pastTeams;
    mapping(uint256 => mapping(address => string))      public pastPlayerNames;
    mapping(uint256 => mapping(address => string))        public pastTeamNames;
    mapping(uint256 => address)                           public pastWinners;
    mapping(uint256 => uint256)                           public pastPrizePools;

    // events
    event PlayerJoined(address indexed user);
    event StatsUpdated(uint256 indexed playerId);
    event TeamSubmitted(address indexed user, string playerName, string teamName, uint256[] playerIds, uint256 captainId);
    event PlayerNameUpdated(address indexed user, string newName);
    event TeamNameUpdated(address indexed user, string newTeamName);
    event PointsRecorded(address indexed user, uint256 matchId, uint256 points);
    event LeaderboardRanked(address indexed user, uint256 rank);
    event PrizePaid(address indexed to, uint256 amount, uint256 season, string PlayerName, string teamName);
    event OwnerPaid(address indexed to, uint256 amount, uint256 season);
    event NewSeasonStarted(uint256 newSeason);

    constructor(uint256 _entryFee, address oracle) payable {
        entryFee = _entryFee;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, oracle);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    // --- USER FLOWS ---

    function joinLeague() external payable nonReentrant {
        require(msg.value == entryFee, "Incorrect fee");
        require(!hasJoined[msg.sender], "Already joined");
        hasJoined[msg.sender] = true;
        participants.push(msg.sender);
        emit PlayerJoined(msg.sender);
    }

    /// @notice Submit a team. selectedPlayers must be exactly 12 players:
    ///         first 11 are main players, last one is reserve.
    /// @param selectedPlayers array of 12 player IDs (main[0..10], reserve[11])
    /// @param playerName player display name
    /// @param teamName team display name
    /// @param captainId id of the chosen captain (must be one of main[0..10])
    function submitTeam(
        uint256[] calldata selectedPlayers,
        string calldata playerName,
        string calldata teamName,
        uint256 captainId
    ) external nonReentrant {
        require(hasJoined[msg.sender],              "Must join first");
        require(!userTeams[msg.sender].submitted,   "Already submitted");
        require(selectedPlayers.length == 12,       "Exactly 12 players");
        require(bytes(playerName).length <= maxNameLength,     "Name too long");
        require(bytes(teamName).length   <= maxTeamNameLength, "Team name too long");

        bytes32 tn = keccak256(bytes(teamName));
        require(!teamNameTaken[tn], "Team name taken");

        // Validate players and compute cost
        uint256 totalCost = 0;
        for (uint i = 0; i < selectedPlayers.length; i++) {
            uint256 id = selectedPlayers[i];
            require(tracked[id], "Invalid player ID");
            totalCost += players[id].price;
        }
        require(totalCost <= maxTeamBudget, "Budget exceeded");

        // Validate captain is one of the 11 main players (first 11 entries)
        require(captainId != 0, "Invalid captain");
        bool captainFound = false;
        for (uint i = 0; i < 11; i++) {
            if (selectedPlayers[i] == captainId) {
                captainFound = true;
                break;
            }
        }
        require(captainFound, "Captain must be one of the 11 main players");

        // Update selection counts
        for (uint i = 0; i < selectedPlayers.length; i++) {
            uint256 id = selectedPlayers[i];
            playerSelectionCount[id] += 1; // increment count for that player
        }

        // Save team including captain
        FantasyTeam storage ft = userTeams[msg.sender];
        ft.playerIds = selectedPlayers;
        ft.submitted = true;
        ft.captain = captainId;

        playerNames[msg.sender] = playerName;
        teamNames[msg.sender]   = teamName;
        teamNameTaken[tn]       = true;

        leaderboard.push(msg.sender);
        userRank[msg.sender] = leaderboard.length;
        emit LeaderboardRanked(msg.sender, userRank[msg.sender]);
        emit TeamSubmitted(msg.sender, playerName, teamName, selectedPlayers, captainId);
    }

    function updatePlayerName(string calldata newName) external {
        require(userTeams[msg.sender].submitted, "No team yet");
        require(bytes(newName).length <= maxNameLength, "Name too long");
        playerNames[msg.sender] = newName;
        emit PlayerNameUpdated(msg.sender, newName);
    }

    function updateTeamName(string calldata newTeamName) external {
        require(userTeams[msg.sender].submitted, "No team yet");
        require(bytes(newTeamName).length <= maxTeamNameLength, "Team name too long");

        bytes32 newHash = keccak256(bytes(newTeamName));
        require(!teamNameTaken[newHash], "Team name taken");

        bytes32 oldHash = keccak256(bytes(teamNames[msg.sender]));
        teamNameTaken[oldHash] = false;

        teamNames[msg.sender] = newTeamName;
        teamNameTaken[newHash] = true;
        emit TeamNameUpdated(msg.sender, newTeamName);
    }

    // --- ORACLE DATA LOADER ---

    function loadPlayerRaw(
        uint256 id,
        string calldata name,
        string calldata rawStats,
        uint256 price
    ) external onlyRole(ORACLE_ROLE) {
        require(!tracked[id], "Player already added");

        players[id] = Player({
            id: id,
            name: name,
            rawStats: rawStats,
            price: price
        });

        tracked[id] = true;
        playerIds.push(id);
    }

    /// @notice Insert or update a player by name.  Assigns a new `id` if unseen.
    function upsertPlayerRaw(
        string calldata name,
        string calldata rawStats,
        uint256 price
    ) external onlyRole(ORACLE_ROLE) {
        bytes32 key = keccak256(bytes(name));
        uint256 id  = nameToId[key];

        // if new player, assign a fresh id
        if (id == 0) {
            id = nextPlayerId++;
            nameToId[key] = id;

            tracked[id] = true;
            playerIds.push(id);
        }

        // insert-or-update
        players[id] = Player({
            id: id,
            name: name,
            rawStats: rawStats,
            price: price
        });

        emit StatsUpdated(id);
    }

    // View function to return full player info (optional)
    function getPlayer(uint256 id) external view returns (
        uint256,
        string memory,
        string memory
    ) {
        Player memory p = players[id];
        return (p.id, p.name, p.rawStats);
    }

    // --- NAME LIMITS ---
    function setNameLengths(uint8 nameLen, uint8 teamNameLen) external onlyOwner {
        maxNameLength = nameLen;
        maxTeamNameLength = teamNameLen;
    }

    // --- SEASON ARCHIVAL ---
    function endSeasonAndDistribute() external onlyOwner nonReentrant {
        require(leaderboard.length > 0, "Leaderboard is empty");
        uint256 season = currentSeason;

        address payable winner = payable(leaderboard[0]);
        require(hasJoined[winner], "Winner must be a participant");
        require(userTeams[winner].submitted, "Winner must have a team");

        uint256 amount = (address(this).balance * 80) / 100;     // The other 20% is kept to make up for network fees of users interacting with the system
        require(amount > 0, "No funds in prize pool");

        // Transfer prize pool to winner
        (bool sent, ) = winner.call{value: amount}("");
        require(sent, "Prize transfer failed");
        emit PrizePaid(winner, amount, season, playerNames[winner], teamNames[winner]);

        // Transfer the rest to the contract owner
        uint256 remaining = address(this).balance;
        (bool ownerSent, ) = payable(owner()).call{value: remaining}("");
        require(ownerSent, "Owner transfer failed");
        emit OwnerPaid(owner(), remaining, season);
        
        // Archive data

        pastWinners[season] = winner;
        pastPrizePools[season] = amount;

        for (uint i = 0; i < participants.length; i++) {
            address user = participants[i];
            pastParticipants[season].push(user);
            pastTeams[season][user] = userTeams[user];
            pastPlayerNames[season][user] = playerNames[user];
            pastTeamNames[season][user] = teamNames[user];

            // Reset user state
            hasJoined[user] = false;

            // Clear teamNameTaken for the user's team name (compute before delete)
            bytes32 nameHash = keccak256(bytes(teamNames[user]));
            teamNameTaken[nameHash] = false;

            delete userTeams[user];
            delete playerNames[user];
            delete teamNames[user];
        }

        delete participants;
        delete leaderboard;
        currentSeason++;

        emit NewSeasonStarted(currentSeason);
    }

    // --- DEV RESET ---
    function devResetUser(address user) external onlyOwner {
        hasJoined[user] = false;
        delete userTeams[user];
        delete playerNames[user];
        delete teamNames[user];
    }
    function devResetAllUsers(address[] calldata users) external onlyOwner {
        for (uint i = 0; i < users.length; i++) {
            address u = users[i];
            hasJoined[u] = false;
            delete userTeams[u];
            delete playerNames[u];
            delete teamNames[u];
        }
    }
    function devClearParticipants() external onlyOwner {
        delete participants;
    }

    function setEntryFee(uint256 newFee) external onlyOwner {
        entryFee = newFee;
    }

    // --- GETTERS ---
    function getParticipants() external view returns (address[] memory) {
        return participants;
    }
    function getPlayerIds() external view returns (uint256[] memory) {
        return playerIds;
    }
    function hasJoinedLeague(address user) external view returns (bool) {
        return hasJoined[user];
    }
    /// @notice returns (playerIds, submitted, playerName, teamName, userRank, captainId)
    function getUserTeam(address user) external view
      returns (uint256[] memory, bool, string memory, string memory, uint256, uint256)
    {
        FantasyTeam storage ft = userTeams[user];
        return (
          ft.playerIds,
          ft.submitted,
          playerNames[user],
          teamNames[user],
          userRank[user],
          ft.captain
        );
    }
    function getTeamName(address user) external view returns (string memory) {
        return teamNames[user];
    }
    function getPlayerName(address user) external view returns (string memory) {
        return playerNames[user];
    }
    function getLeaderboard() external view returns (address[] memory) {
        return leaderboard;
    }
    
    function getPlayerSelectionCount(uint256 id) external view returns (uint256) {
        return playerSelectionCount[id];
    }
    function getPlayerSelectionPercentage(uint256 id) external view returns (uint256) {
        if (participants.length == 0) return 0;
        return (playerSelectionCount[id] * 1e18) / participants.length; // scaled by 1e18
    }

    // Getters for past seasons
    function getPastParticipants(uint256 season) external view returns (address[] memory) {
        return pastParticipants[season];
    }

    function getPastPlayerNames(uint256 season, address user) external view returns (string memory) {
        return pastPlayerNames[season][user];
    }

    /// @notice returns (playerIds, submitted, captainId)
    function getPastTeam(uint256 season, address user) external view returns (uint256[] memory, bool, uint256) {
        FantasyTeam memory team = pastTeams[season][user];
        return (team.playerIds, team.submitted, team.captain);
    }

    function getPastTeamName(uint256 season, address user) external view returns (string memory) {
        return pastTeamNames[season][user];
    }

    function getPastWinner(uint256 season) external view returns (address) {
        return pastWinners[season];
    }

    function getPastPrizePool(uint256 season) external view returns (uint256) {
        return pastPrizePools[season];
    }

    function getTotalCompletedSeasons() external view returns (uint256) {
        return currentSeason - 1;
    }

    // --- PRIZE POOL ---
    function withdrawPrizePool(address payable to)
      external onlyOwner nonReentrant
    {
        uint256 amount = address(this).balance;
        require(amount > 0, "No funds");
        to.transfer(amount);
    }
    function getPrizePool() external view returns (uint256) {
        return address(this).balance;
    }
}

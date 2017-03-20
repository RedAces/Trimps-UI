// ==UserScript==//
// @name           RedAces Trimps-UI
// @namespace      https://github.com/RedAces/Trimps-UI
// @description    Some Trimp automation
// @grant          none
// @downloadUrl    https://github.com/RedAces/Trimps-UI/raw/master/TrimpsUI.user.js
// @include        http://trimps.github.io
// @include        https://trimps.github.io
// @include        http://trimps.github.io/*
// @include        https://trimps.github.io/*
// ==/UserScript==

window.RedAcesUI         = window.RedAcesUI || {};
window.RedAcesUI.options = {
    "autoBuild": {
        "enabled":           1,
        "warpstationZero":  30,
        "warpstationDelta":  4,
        "buildings": {
            "Gym":         -1,
            "Tribute":     -1,
            "Collector":   41,
            "Gateway":     25,
            "Resort":      50,
            "Hotel":       75,
            "Mansion":    100,
            "House":      100,
            "Hut":        100
        },
        "cheapBuildings": {
            "Collector": {
                "otherBuilding": "Warpstation",
                "resource":             "gems",
                "relation":                0.1
            },
            "Nursery": {
                "otherBuilding":         "Gym",
                "resource":             "wood",
                "relation":                0.1
            }
        }
    },
    "autoHireTrimps": {
        "enabled":         1,
        "fireAllForVoids": 1,
        "startWorldZone":  5
    },
    "autoGather": {
        "enabled": 1
    },
    "displayEfficiency": {
        "enabled": 1
    },
    "autoBuyEquipment": {
        "enabled":                       1,
        "maxLevelPrestigeAvailable":     5,
        "maxLevelPrestigeUnavailable":  40,
        "maxRelEfficiency":            1.5
    },
    "autoPause": {
        "enabled":      0,
        "worldLevel": 179
    }
};

/** Prestige efficiency calculation */

window.RedAcesUI.attackAfterPrestige = function(base, prestige) {
    if (prestige <= 0) {
        // prestige == 0 => no prestige (so Prestige I)
        return base;
    }
    // prestige == 2 => prestiged 2 times (so Prestige III)
    return base * 11.51 * Math.pow(9.59, prestige - 1);
};

window.RedAcesUI.healthAfterPrestige = function(base, prestige) {
    if (prestige <= 0) {
        // prestige == 0 => no prestige (so Prestige I)
        return base;
    }
    // prestige == 2 => prestiged 2 times (so Prestige III)
    return base * 13.61 * Math.pow(11.42, prestige - 1);
};

/** Build x buildings */
window.RedAcesUI.buyEquipment = function(equipmentName, amount) {
    if (!game.equipment.hasOwnProperty(equipmentName) || game.equipment[equipmentName].locked) {
        return;
    }
    if (amount !== "Max") {
        amount = Math.min(amount, calculateMaxAfford(game.equipment[equipmentName], false, true));
        if (amount <= 0) {
            return;
        }
    }
    var currentBuyAmount = game.global.buyAmt;
    game.global.buyAmt   = amount;
    buyEquipment(equipmentName, false, true);
    game.global.buyAmt   = currentBuyAmount;
};

/** Equipment efficiency */
window.RedAcesUI.displayEfficiency = function () {
    if (!window.RedAcesUI.options.displayEfficiency.enabled && !window.RedAcesUI.options.autoBuyEquipment.enabled) {
        return;
    }
    var costMult = Math.pow(1 - game.portal.Artisanistry.modifier, game.portal.Artisanistry.level),
        items    = {"Health": [], "Attack": []},
        itemName,
        stat,
        itemPrestiges = {};

    // fill the array with the equipment information
    for (itemName in game.equipment) {
        if (!game.equipment.hasOwnProperty(itemName)) {
            continue;
        }
        var data = game.equipment[itemName],
            gain;

        if ((data.locked == 1) || data.hasOwnProperty('blockCalculated')) {
            continue;
        }

        if (data.hasOwnProperty('attackCalculated')) {
            gain = data.attackCalculated;
            stat = 'Attack';
        } else if (data.hasOwnProperty('healthCalculated')) {
            gain = data.healthCalculated;
            stat = 'Health';
        } else {
            continue;
        }

        if (Object.keys(data.cost).length > 1) {
            continue;
        }

        var resource     = Object.keys(data.cost)[0],
            cost         = data.cost[resource][0] * Math.pow(data.cost[resource][1], data.level) * costMult,
            costPerValue = cost / gain;

        if ((resource != 'metal') || (gain == 0)) {
            continue;
        }

        items[stat].push({"item": itemName, "costPerValue": costPerValue});
    }

    // equipment prestiges
    for (var upgradeName in game.upgrades) {
        if (!game.upgrades.hasOwnProperty(upgradeName)) {
            continue;
        }

        var upgradeData = game.upgrades[upgradeName];

        if (!upgradeData.hasOwnProperty('prestiges')
            || !game.equipment.hasOwnProperty(upgradeData.prestiges)
        ) {
            continue;
        }

        itemPrestiges[upgradeData.prestiges] = upgradeData;

        if ((upgradeData.locked == 1)
            || !upgradeData.hasOwnProperty('cost')
            || !upgradeData.cost.hasOwnProperty('resources')
            || !upgradeData.cost.resources.hasOwnProperty('metal')
        ) {
            continue;
        }
        var equipData = game.equipment[upgradeData.prestiges],
            gain;

        if (equipData.hasOwnProperty('attack')) {
            stat = 'Attack';
            gain = window.RedAcesUI.attackAfterPrestige(equipData.attack, upgradeData.done + 1);
        } else if (equipData.hasOwnProperty('health')) {
            stat = 'Health';
            gain = window.RedAcesUI.healthAfterPrestige(equipData.health, upgradeData.done + 1);
        }

        items[stat].push({"item": upgradeName, "costPerValue": upgradeData.cost.resources.metal * costMult / gain});
    }

    // sort and display
    for (stat in items) {
        if (!items.hasOwnProperty(stat)) {
            continue;
        }

        items[stat].sort(
            function (a, b) {
                return a.costPerValue - b.costPerValue;
            }
        );

        var bestStatEfficiency = 1;
        for (var i in items[stat]) {
            if (!items[stat].hasOwnProperty(i)) {
                continue;
            }

            itemName = items[stat][i].item;

            if (i == 0) {
                bestStatEfficiency = items[stat][i].costPerValue;
            }

            if (window.RedAcesUI.options.displayEfficiency.enabled) {
                var efficiencySpan = document.getElementById('RedAcesUIEff' + itemName);

                if (efficiencySpan == undefined) {
                    efficiencySpan = document.createElement('span');
                    efficiencySpan.id = 'RedAcesUIEff' + itemName;
                    var itemElement = document.getElementById(itemName);
                    if (itemElement == undefined) {
                        continue;
                    }
                    itemElement.appendChild(efficiencySpan);
                }

                var cssColor = '';
                if (i == 0) {
                    cssColor = 'background-color:green;';
                } else if (items[stat][i].costPerValue / bestStatEfficiency < window.RedAcesUI.options.autoBuyEquipment.maxRelEfficiency) {
                    cssColor = 'background-color:yellow;color:black;';
                }

                efficiencySpan.innerHTML = '<br/><span style="padding:2px 5px;' + cssColor + '">'
                    + stat + ' #' + (1 * i + 1) + ' ('
                    + (items[stat][i].costPerValue / bestStatEfficiency * 100).toFixed(0) + '%)</span>';
            }

            if (window.RedAcesUI.options.autoBuyEquipment.enabled
                && game.global.hasOwnProperty('autoPrestiges')
                && ((game.global.autoPrestiges == 1)
                    || (((game.global.autoPrestiges == 2) || (game.global.autoPrestiges == 3)) && (stat == 'Attack')))
                && game.equipment.hasOwnProperty(itemName)
            ) {
                // 1 ... Auto-Prestige "all"
                // 2 ... Auto-Prestige "Weapons Only" -> Auto Buy Weapons only
                // 3 ... Auto-Prestige "Weapons First" -> Auto Buy Weapons only

                equipData = game.equipment[itemName];
                if (items[stat][i].costPerValue / bestStatEfficiency < window.RedAcesUI.options.autoBuyEquipment.maxRelEfficiency) {
                    if (equipData.level < window.RedAcesUI.options.autoBuyEquipment.maxLevelPrestigeAvailable) {
                        window.RedAcesUI.buyEquipment(itemName, 1);
                    } else if (itemPrestiges.hasOwnProperty(itemName)
                        && (itemPrestiges[itemName].allowed === itemPrestiges[itemName].done)
                        && (equipData.level < window.RedAcesUI.options.autoBuyEquipment.maxLevelPrestigeUnavailable)
                    ) {
                        // there is no prestige available
                        window.RedAcesUI.buyEquipment(itemName, 1);
                    }
                }
            }
        }
    }

    // Special case: Shield
    if (game.equipment.hasOwnProperty('Shield')
        && (game.equipment.Shield.locked == 0)
        && (game.equipment.Shield.level < window.RedAcesUI.options.autoBuyEquipment.maxLevelPrestigeAvailable)
        && (game.global.hasOwnProperty('autoPrestiges'))
        && (game.global.autoPrestiges == 1) // Auto-Prestige "all"
    ) {
        window.RedAcesUI.buyEquipment('Shield', 1);
    }
};

/** Hires x trimps for a job */
window.RedAcesUI.hire = function(jobName, amount) {
    if (!game.jobs.hasOwnProperty(jobName) || (game.jobs[jobName].locked)) {
        return
    }
    var currentBuyAmount = game.global.buyAmt,
        firingMode       = game.global.firing;

    if (amount === "Max") {
        // do nothing
    } else if (amount < 0) {
        game.global.firing = true;
        amount             = Math.min(
            Math.abs(amount),
            game.jobs[jobName].owned
        );
    } else {
        game.global.firing = false;
        amount             = Math.min(
            amount,
            calculateMaxAfford(game.jobs[jobName], false, false, true),
            // unemployed
            Math.ceil(game.resources.trimps.realMax() / 2) - game.resources.trimps.employed
        );
    }

    if (amount === 0) {
        return;
    }

    game.global.buyAmt = amount;
    buyJob(jobName, false, true);
    game.global.buyAmt = currentBuyAmount;
    game.global.firing = firingMode;
};

/** Auto employment of trimps */
window.RedAcesUI.autoHireTrimps = function() {
    if (!window.RedAcesUI.options.autoHireTrimps.enabled) {
        return;
    }

    if (game.resources.trimps.owned / game.resources.trimps.realMax() < 0.5) {
        // dont hire anyone if we've got less than half the amount of trimps
        return;
    }

    var mapObj = getCurrentMapObject();
    if (game.global.world < window.RedAcesUI.options.autoHireTrimps.startWorldZone) {
        return;
    } else if ((mapObj !== undefined)
        && (mapObj.location == "Void")
        && window.RedAcesUI.options.autoHireTrimps.fireAllForVoids
    ) {
        var jobRatios = {
                "Miner":      0,
                "Lumberjack": 0,
                "Farmer":     0,
                "Scientist":  0
            },
            jobRatioSum = 1;
    } else if (game.global.world <= 150) {
        var jobRatios   = {
                "Miner":      100,
                "Lumberjack": 100,
                "Farmer":      10,
                "Scientist":    1
            },
            jobRatioSum = 211;
    } else {
        var jobRatios   = {
                "Miner":      100,
                "Lumberjack":  50,
                "Farmer":      10,
                "Scientist":    0
            },
            jobRatioSum = 160;
    }

    if (!game.jobs.hasOwnProperty('Miner') || game.jobs.Miner.locked) {
        jobRatioSum    -= jobRatios.Miner;
        jobRatios.Miner = 0;
    }

    var maxWorkerTrimps = Math.ceil(game.resources.trimps.realMax() / 2);

    if (game.jobs.hasOwnProperty('Trainer')) {
        maxWorkerTrimps -= game.jobs['Trainer'].owned;
    }

    if (game.jobs.hasOwnProperty('Explorer')) {
        maxWorkerTrimps -= game.jobs['Explorer'].owned;
    }

    if (game.jobs.hasOwnProperty('Geneticist')) {
        maxWorkerTrimps -= game.jobs['Geneticist'].owned;
    }

    window.RedAcesUI.hire('Trainer', 'Max');
    window.RedAcesUI.hire('Explorer', 'Max');

    for (var jobName in jobRatios) {
        if (!jobRatios.hasOwnProperty(jobName) || !game.jobs.hasOwnProperty(jobName)) {
            continue;
        }

        var jobRatio           = jobRatios[jobName],
            jobEmployees       = game.jobs[jobName].owned,
            targetJobEmployees = Math.floor(maxWorkerTrimps * jobRatio / jobRatioSum);

        window.RedAcesUI.hire(jobName, Math.floor(targetJobEmployees - jobEmployees));
    }
};

/** Build x buildings */
window.RedAcesUI.build = function(buildingName, amount) {
    if (!game.buildings.hasOwnProperty(buildingName) || game.buildings[buildingName].locked) {
        return;
    }
    if (amount !== "Max") {
        amount = Math.min(amount, calculateMaxAfford(game.buildings[buildingName], true, false, false, true));
        if (amount <= 0) {
            return;
        }
    }
    var currentBuyAmount = game.global.buyAmt;
    game.global.buyAmt   = amount;
    buyBuilding(buildingName, false, true);
    game.global.buyAmt   = currentBuyAmount;
};

/** Auto building Buildings */
window.RedAcesUI.autoBuild = function() {
    if (!window.RedAcesUI.options.autoBuild.enabled) {
        return;
    }

    for (var buildingName in window.RedAcesUI.options.autoBuild.buildings) {
        if (!window.RedAcesUI.options.autoBuild.buildings.hasOwnProperty(buildingName)
            || !game.buildings.hasOwnProperty(buildingName)
        ) {
            continue;
        }

        var buildingMax    = window.RedAcesUI.options.autoBuild.buildings[buildingName],
            currentAmount  = game.buildings[buildingName].purchased;

        if (buildingMax === -1) {
            window.RedAcesUI.build(buildingName, "Max");
        } else if (buildingMax > currentAmount) {
            window.RedAcesUI.build(buildingName, buildingMax - currentAmount);
        }
    }

    if (game.upgrades.hasOwnProperty('Gigastation') && game.buildings.hasOwnProperty('Warpstation')) {
        var currentGigastation = game.upgrades.Gigastation.done,
            currentWarpstation = game.buildings.Warpstation.purchased,
            warpstationLimit   = window.RedAcesUI.options.autoBuild.warpstationZero
                + window.RedAcesUI.options.autoBuild.warpstationDelta * currentGigastation;

        if (currentWarpstation < warpstationLimit) {
            window.RedAcesUI.build('Warpstation', warpstationLimit - currentWarpstation);
        } else if (game.upgrades.Gigastation.locked == 0) {
            buyUpgrade('Gigastation', true, true);
        }
    }

    for (var buildingName in window.RedAcesUI.options.autoBuild.cheapBuildings) {
        if (!window.RedAcesUI.options.autoBuild.cheapBuildings.hasOwnProperty(buildingName)
            || !game.buildings.hasOwnProperty(buildingName)
            || game.buildings[buildingName].locked
        ) {
            continue;
        }
        var cheapBuildingData = window.RedAcesUI.options.autoBuild.cheapBuildings[buildingName];

        if (!game.buildings.hasOwnProperty(cheapBuildingData.otherBuilding)
            || game.buildings[cheapBuildingData.otherBuilding].locked
            || !game.buildings[cheapBuildingData.otherBuilding].cost.hasOwnProperty(cheapBuildingData.resource)

            || !game.buildings[buildingName].cost.hasOwnProperty(cheapBuildingData.resource)
        ) {
            continue;
        }

        var thisCostArray  = game.buildings[buildingName].cost[cheapBuildingData.resource],
            otherCostArray = game.buildings[cheapBuildingData.otherBuilding].cost[cheapBuildingData.resource],
            buildingCost   = thisCostArray[0]  * Math.pow(thisCostArray[1],  game.buildings[buildingName].purchased),
            otherCost      = otherCostArray[0] * Math.pow(otherCostArray[1], game.buildings[cheapBuildingData.otherBuilding].purchased);

        if (buildingCost / otherCost <= cheapBuildingData.relation) {
            // console.debug(
            //     'Buying 1 ' + buildingName + ' because the relation of ' + cheapBuildingData.resource + ' to '
            //     + cheapBuildingData.otherBuilding + ' is ' + buildingCost / otherCost
            //     + ', which is less than ' + cheapBuildingData.relation
            // );
            window.RedAcesUI.build(buildingName, 1);
        }
    }
};

/** Auto player employment */
window.RedAcesUI.autoGather = function() {
    if (!window.RedAcesUI.options.autoGather.enabled) {
        return;
    }
    if (game.global.buildingsQueue.length > 0) {
        setGather('buildings');
        return;
    }

    var importantUpgrades = [
        "Speedlumber",
        "Speedfarming",
        "Speedminer",
        "Speedscience",
        "Megalumber",
        "Megafarming",
        "Megaminer",
        "Megascience",
        "Gymystic"
    ];
    for (var i in importantUpgrades) {
        if (!importantUpgrades.hasOwnProperty(i)) {
            continue;
        }

        var upgradeName = importantUpgrades[i];

        if (!game.upgrades.hasOwnProperty(upgradeName)) {
            continue;
        }

        var upgrade = game.upgrades[upgradeName];

        if (upgrade.locked || (upgrade.done >= upgrade.allowed)) {
            continue;
        }

        setGather('science');
        return;
    }

    if (!game.jobs.hasOwnProperty('Miner') || game.jobs.Miner.locked || (game.global.turkimpTimer > 0)) {
        setGather('metal');
    } else {
        setGather('science');
    }
};

/** Auto pause game at a certain world level */
window.RedAcesUI.autoPause = function() {
    if (!window.RedAcesUI.options.autoPause.enabled) {
        return;
    }

    if (game.global.world >= RedAcesUI.options.autoPause.worldLevel && (game.options.menu.pauseGame.enabled == 0)) {
        toggleSetting('pauseGame');
    }
};

/** Runs a newly bought map */
window.RedAcesUI.runNewMap = function(repeatUntil) {
    if (game.global.currentMapId != '') {
        // We're already running a map!
        return 'already running a map';
    }

    if (!game.global.switchToMaps && !game.global.preMapsActive) {
        // switch to maps screen and wait for it
        mapsClicked();

        if (game.global.switchToMaps && !game.global.preMapsActive) {
            // skip "waiting for trimps to die"
            mapsClicked();
        }
    }

    if (!game.global.preMapsActive) {
        // Not in the maps screen now ... something has gone wrong!
        return 'not in maps screen';
    }

    document.getElementById('biomeAdvMapsSelect').value = 'Plentiful';
    adjustMap('loot', 9);
    adjustMap('size', 9);
    adjustMap('difficulty', 9);
    updateMapCost();

    if (!game.global.repeatMap) {
        repeatClicked();
    }

    while (game.options.menu.repeatUntil.enabled != repeatUntil) {
        // 0 ... "Repeat forever"
        // 1 ... "Repeat to 10"
        // 2 ... "Repeat for items"
        toggleSetting('repeatUntil')
    }

    while (game.options.menu.exitTo.enabled != 1) {
        // 1 ... "Exit to World"
        toggleSetting('exitTo')
    }

    if (buyMap() < 0) {
        return 'buying a map failed';
    }

    // new map is selected -> run it
    runMap();
};

/** Runs all void maps */
window.RedAcesUI.runVoidMaps = function() {
    if (game.global.currentMapId != '') {
        // We're already running a map!
        return 'already running a map';
    }

    if (game.global.totalVoidMaps == 0) {
        // There are no void maps
        return 'no void maps';
    }

    if (!game.global.switchToMaps && !game.global.preMapsActive) {
        // switch to maps screen and wait for it
        mapsClicked();

        if (game.global.switchToMaps && !game.global.preMapsActive) {
            // skip "waiting for trimps to die"
            mapsClicked();
        }
    }

    if (!game.global.preMapsActive) {
        // Not in the maps screen now ... something has gone wrong!
        return 'not in maps screen';
    }

    toggleVoidMaps();

    while (game.options.menu.repeatVoids.enabled != 1) {
        // 0 ... "One Void Map"
        // 1 ... "All Void Maps"
        toggleSetting('repeatVoids');
    }

    while (game.options.menu.exitTo.enabled != 1) {
        // 1 ... "Exit to World"
        toggleSetting('exitTo')
    }

    for (var i in game.global.mapsOwnedArray) {
        if (!game.global.mapsOwnedArray.hasOwnProperty(i)) {
            continue;
        }
        var map = game.global.mapsOwnedArray[i];
        if (map.location == 'Void') {
            // Found one! Run it and all is good!
            selectMap(map.id);
            runMap();
            return;
        }
    }
};

/** Auto runs the "Corrupted" Challenge */

window.RedAcesUI.autoRunCorruptedChallenge = function() {
    if ((game.global.world > 200)
        || (game.global.world < 10)
        || ((game.global.world == 200) && window.RedAcesUI.options.autoRunCorruptedChallenge.done)
    ) {
        // nothing to do here anymore!
        return;
    }

    // We're not done yet!
    window.RedAcesUI.options.autoRunCorruptedChallenge = {"done": 0};

    if (game.global.pauseFight) {
        // Set 'AutoFight On'
        pauseFight();
    }

    if (getAvailableGoldenUpgrades() > 0) {
        buyGoldenUpgrade('Helium');
    }

    // Auto-Stance
    var mapObj          = getCurrentMapObject(),
        targetFormation;

    if (((mapObj !== undefined) && (mapObj.location == "Void"))) {
        targetFormation = 2; // Dominance
    } else {
        targetFormation = 4; // Scryer
    }
    if ((game.upgrades.Formations.allowed) && (game.global.formation != targetFormation) && (game.global.world >= 60)) {
        console.log('RA:autoRunCorruptedChallenge(): setting formation');
        setFormation(targetFormation)
    }

    // toggle Geneticistassist until it is >= 6 seconds
    if (!game.jobs.Geneticist.locked) {
        while (game.global.GeneticistassistSetting < 6) {
            console.log('RA:autoRunCorruptedChallenge(): toggling GA');
            toggleGeneticistassist();
        }
    }

    // Auto run Maps
    if (game.global.currentMapId != '') {
        // We're already running a map!
        return;
    }

    if (game.global.world < 180) {
        if ((game.global.world % 5 == 0)
            && (game.global.world % 10 != 0)
            && (addSpecials(true, true, null, true).length > 0)
        ) {
            // addSpecials(..) will return a max of 13 (all prestiges one time)
            console.log('RA:autoRunCorruptedChallenge(): running maps for prestiges');
            window.RedAcesUI.runNewMap(2); // Repeat for items
        }
        return;
    }

    if ((game.global.mapBonus < 10)
        && (game.global.world % 2 == 0)
        && (game.global.world < 200)
    ) {
        console.log('RA:autoRunCorruptedChallenge(): running maps for stacking damage boost');
        window.RedAcesUI.runNewMap(1); // Repeat to 10
        return;
    }

    if ((game.global.world == 190)
        && (game.global.mapBonus >= 10)
        && (game.global.totalVoidMaps > 0)
    ) {
        // We're ready for the voids! TODO Set GA to 30 secs?
        console.log('RA:autoRunCorruptedChallenge(): running void maps');
        window.RedAcesUI.runVoidMaps();
        return;
    }

    if (game.global.world == 200) {
        // We're done! Let it farm and the user may choose what to do next
        console.log('RA:autoRunCorruptedChallenge(): running level 200 map to farm forever');
        window.RedAcesUI.runNewMap(0); // Repeat forever
        window.RedAcesUI.options.autoRunCorruptedChallenge.done = 1;
        return;
    }
};

/** init main loop */

window.RedAcesUI.mainLoop = function() {
    document.title = 'Trimps z' + game.global.world + '-' + (game.global.lastClearedCell + 2);
    if (getAvailableGoldenUpgrades() > 0) {
        document.title = 'GOLDEN ' + document.title;
    }

    window.RedAcesUI.autoHireTrimps();
    window.RedAcesUI.autoBuild();
    window.RedAcesUI.autoGather();
    window.RedAcesUI.displayEfficiency();
    window.RedAcesUI.autoPause();
    window.RedAcesUI.autoRunCorruptedChallenge();
};

window.RedAcesUI.mainTimer = setInterval(
    window.RedAcesUI.mainLoop,
    1000
);

/** options */

window.RedAcesUI.toggleAutomation = function (what) {
    window.RedAcesUI.options[what].enabled = !window.RedAcesUI.options[what].enabled;
    var button = document.getElementById('RedAcesUIOpt' + what);
    if (window.RedAcesUI.options[what].enabled) {
        button.className = 'pointer noselect colorSuccess';
    } else {
        button.className = 'pointer noselect colorDanger';
    }
};

/** Show options buttons */
window.RedAcesUI.displayOptions = function() {
    var displayButton = function (what, label, where, fullSize) {
        var button          = document.createElement('div');
        button.className    = 'pointer noselect colorSuccess';
        button.innerHTML    = label;
        button.id           = 'RedAcesUIOpt' + what;
        button.onclick      = function () {
            window.RedAcesUI.toggleAutomation(what);
        };

        button.style.border   = '1px solid white';
        button.style.padding  = '0 5px';
        button.style.fontSize = '0.9vw';

        if (fullSize) {
            where.innerHTML = '';
        } else {
            button.style.display = 'inline';
        }
        where.appendChild(button);
    };

    var jobsTitleSpan = document.getElementById('jobsTitleSpan');
    if (jobsTitleSpan) {
        displayButton('autoHireTrimps', 'AutoHire', jobsTitleSpan.parentNode, false);
    }

    var equipmentTitleDiv = document.getElementById('equipmentTitleDiv');
    if (equipmentTitleDiv) {
        displayButton('autoBuyEquipment', 'AutoBuyEquip', equipmentTitleDiv.childNodes[1].childNodes[3], true);
    }

    var buildingsTitleDiv = document.getElementById('buildingsTitleDiv');
    if (buildingsTitleDiv) {
        displayButton('autoBuild', 'AutoBuild', buildingsTitleDiv.childNodes[1].childNodes[3], true);
    }
};

window.RedAcesUI.displayOptions();

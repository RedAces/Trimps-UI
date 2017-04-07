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
        "enabled":          true,
        "warpstationZero":    18,
        "warpstationDelta":    6,
        "buildings": {
            "Gym":            -1,
            "Tribute":        -1,
            "Collector":      50,
            "Gateway":        25,
            "Resort":         50,
            "Hotel":          75,
            "Mansion":       100,
            "House":         100,
            "Hut":           100
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
                "relation":               0.01,
                "untilWorldZone":          201,
                "maxAmount":              1000
            }
        }
    },
    "autoHireTrimps": {
        "enabled":         true,
        "fireAllForVoids": true
    },
    "autoGather": {
        "enabled": true
    },
    "displayEfficiency": {
        "enabled": true
    },
    "autoBuyEquipment": {
        "enabled":                     true,
        "maxLevelPrestigeAvailable":      5,
        "maxLevelPrestigeUnavailable":   20,
        "maxRelEfficiency":             1.5
    },
    "autoPause": {
        "enabled":    false,
        "worldLevel":   179
    },
    "autoPlay": {
        "enabled":                    true,
        "voidMapCell":                  90,
        "overkillUntilZone":           210,
        "oneshotUntilZone":            220,
        "scryerUntilZone":             230,
        "dominanceUntilZone":          235,

        // VM in Magma
        "voidMapZone":                 240,
        "targetVoidMapNumHits":          2,
        "buyGoldenVoidUntil":          200,
        "voidMapFormation":              2, // Dominance

        "targetEnemy":          'Turtlimp',
        "targetSpireCell":              89,
        "targetSpireNumHits":            8
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

/** Buy x equipment levels */
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

/** calculates the Artisanistry multiplicator for all thingies */
window.RedAcesUI.getArtisanistryMult = function() {
    return Math.pow(1 - game.portal.Artisanistry.modifier, game.portal.Artisanistry.level);
};

/** calculates the Resourceful multiplicator for all structures */
window.RedAcesUI.getResourcefulMult = function() {
    return Math.pow(1 - game.portal.Resourceful.modifier, game.portal.Resourceful.level);
};

/** calculates the cost for all thingies (without cost mult!) */
window.RedAcesUI.calcCost = function(cost, level) {
    // e. g. window.RedAcesUI.calcCost(game.buildings.Warpstation.cost.metal, 100)
    return cost[0] * Math.pow(cost[1], level);
};

/** Equipment efficiency */
window.RedAcesUI.displayEfficiency = function () {
    if (!window.RedAcesUI.options.displayEfficiency.enabled && !window.RedAcesUI.options.autoBuyEquipment.enabled) {
        return;
    }
    var costMult = window.RedAcesUI.getArtisanistryMult(),
        items    = {"Health": [], "Attack": []},
        itemName,
        stat,
        itemPrestiges = {},
        gain;

    // fill the array with the equipment information
    for (itemName in game.equipment) {
        if (!game.equipment.hasOwnProperty(itemName)) {
            continue;
        }
        var data = game.equipment[itemName];

        if (data.locked || data.hasOwnProperty('blockCalculated')) {
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
            cost         = window.RedAcesUI.calcCost(data.cost[resource], data.level) * costMult,
            costPerValue = cost / gain;

        if ((resource !== 'metal') || (gain == 0)) {
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

        if (upgradeData.locked
            || !upgradeData.hasOwnProperty('cost')
            || !upgradeData.cost.hasOwnProperty('resources')
            || !upgradeData.cost.resources.hasOwnProperty('metal')
        ) {
            continue;
        }
        var equipData = game.equipment[upgradeData.prestiges];

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
                var itemElement = document.getElementById(itemName);
                if (typeof itemElement === 'undefined') {
                    continue;
                }

                if (i == 0) {
                    itemElement.style.borderColor = 'lightgreen';
                    itemElement.style.color       = 'lightgreen';
                } else if (items[stat][i].costPerValue / bestStatEfficiency < window.RedAcesUI.options.autoBuyEquipment.maxRelEfficiency) {
                    itemElement.style.borderColor = 'yellow';
                    itemElement.style.color       = 'yellow';
                } else {
                    itemElement.style.borderColor = 'white';
                    itemElement.style.color       = 'white';
                }
            }

            if (window.RedAcesUI.options.autoBuyEquipment.enabled
                && game.equipment.hasOwnProperty(itemName)
                && game.global.hasOwnProperty('autoPrestiges')
                && ((game.global.autoPrestiges == 1)
                    || (((game.global.autoPrestiges == 2) || (game.global.autoPrestiges == 3)) && (stat == 'Attack')))
            ) {
                // 1 ... Auto-Prestige "all"
                // 2 ... Auto-Prestige "Weapons Only" -> Auto Buy Weapons only
                // 3 ... Auto-Prestige "Weapons First" -> Auto Buy Weapons only

                equipData = game.equipment[itemName];
                if (items[stat][i].costPerValue / bestStatEfficiency < window.RedAcesUI.options.autoBuyEquipment.maxRelEfficiency) {
                    if (itemPrestiges.hasOwnProperty(itemName)
                        && (itemPrestiges[itemName].allowed > itemPrestiges[itemName].done)
                        && (equipData.level < window.RedAcesUI.options.autoBuyEquipment.maxLevelPrestigeAvailable)
                    ) {
                        // there is a prestige available
                        // if (RedAcesUI.getNumberOfHitsToKillEnemy('Map') > 1) {
                            // Only buy equipment if needed, otherwise wait for prestiges!
                            window.RedAcesUI.buyEquipment(itemName, 1);
                        // }
                    } else if (equipData.level < window.RedAcesUI.options.autoBuyEquipment.maxLevelPrestigeUnavailable) {
                        window.RedAcesUI.buyEquipment(itemName, 1);
                    }
                }
            }
        }
    }

    // Special case: Shield
    if (game.equipment.hasOwnProperty('Shield')
        && !game.equipment.Shield.locked
        && (game.equipment.Shield.level < window.RedAcesUI.options.autoBuyEquipment.maxLevelPrestigeAvailable)
        && (game.global.hasOwnProperty('autoPrestiges'))
        && (game.global.autoPrestiges == 1) // Auto-Prestige "all"
    ) {
        window.RedAcesUI.buyEquipment('Shield', 1);
    }
};

/** Hires x trimps for a job */
window.RedAcesUI.hire = function(jobName, amount) {
    if (game.global.firing || !game.jobs.hasOwnProperty(jobName) || (game.jobs[jobName].locked)) {
        return
    }

    var currentBuyAmount = game.global.buyAmt;

    if (amount === "Max") {
        // do nothing
    } else if (amount < 0) {
        game.global.firing = true;
        amount             = Math.min(
            Math.abs(amount),
            game.jobs[jobName].owned
        );
    } else {
        amount = Math.min(
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
    game.global.firing = false;
};

/** Auto employment of trimps */
window.RedAcesUI.autoHireTrimps = function() {
    if (!window.RedAcesUI.options.autoHireTrimps.enabled) {
        return;
    }

    if (game.resources.trimps.owned / game.resources.trimps.realMax() < 0.75) {
        // dont hire anyone if we've got less than 75 % of the max amount of trimps
        return;
    }

    var mapObj = getCurrentMapObject(),
        jobRatios,
        jobRatioSum;

    if (game.global.mapsActive
        && (mapObj.location === 'Void')
        && window.RedAcesUI.options.autoHireTrimps.fireAllForVoids
    ) {
        jobRatios = {
            "Miner":      0,
            "Lumberjack": 0,
            "Farmer":     0,
            "Scientist":  0
        };
        jobRatioSum = 1;
    } else if (game.global.world <= 150) {
        jobRatios   = {
            "Miner":      100,
            "Lumberjack": 100,
            "Farmer":      10,
            "Scientist":    1
        };
        jobRatioSum = 211;
    } else {
        jobRatios   = {
            "Miner":      100,
            "Lumberjack":  50,
            "Farmer":      10,
            "Scientist":    0
        };
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
        maxWorkerTrimps -= game.jobs.Explorer.owned;
    }

    if (game.jobs.hasOwnProperty('Geneticist')) {
        maxWorkerTrimps -= game.jobs.Geneticist.owned;
    }

    if (game.jobs.hasOwnProperty('Magmamancer')) {
        maxWorkerTrimps -= game.jobs.Magmamancer.owned;
    }

    window.RedAcesUI.hire('Trainer', 'Max');
    window.RedAcesUI.hire('Magmamancer', 'Max');
    window.RedAcesUI.hire('Explorer', 'Max');

    for (var jobName in jobRatios) {
        if (!jobRatios.hasOwnProperty(jobName) || !game.jobs.hasOwnProperty(jobName)) {
            continue;
        }

        var jobRatio           = jobRatios[jobName],
            jobEmployees       = game.jobs[jobName].owned,
            targetJobEmployees = Math.floor(maxWorkerTrimps * jobRatio / jobRatioSum);

        if ((jobName === 'Farmer') && (targetJobEmployees > 100)) {
            targetJobEmployees -= 100;
        }

        window.RedAcesUI.hire(jobName, Math.floor(targetJobEmployees - jobEmployees));
    }
};

/** Build x buildings */
window.RedAcesUI.build = function(buildingName, amount) {
    if (!game.buildings.hasOwnProperty(buildingName) || game.buildings[buildingName].locked) {
        return;
    }
    if (amount !== 'Max') {
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
        } else if (!game.upgrades.Gigastation.locked) {
            buyUpgrade('Gigastation', true, true);
        }
    }

    for (buildingName in window.RedAcesUI.options.autoBuild.cheapBuildings) {
        if (!window.RedAcesUI.options.autoBuild.cheapBuildings.hasOwnProperty(buildingName)
            || !game.buildings.hasOwnProperty(buildingName)
            || game.buildings[buildingName].locked
        ) {
            continue;
        }

        var cheapBuildingData = window.RedAcesUI.options.autoBuild.cheapBuildings[buildingName],
            otherBuildingName = cheapBuildingData.otherBuilding;

        if (cheapBuildingData.hasOwnProperty('untilWorldZone')
            && (game.global.world > cheapBuildingData.untilWorldZone)
        ) {
            continue;
        }

        if (cheapBuildingData.hasOwnProperty('maxAmount')
            && (cheapBuildingData.purchased >= cheapBuildingData.maxAmount)
        ) {
            continue;
        }

        if (!game.buildings.hasOwnProperty(otherBuildingName)
            || game.buildings[otherBuildingName].locked
            || !game.buildings[otherBuildingName].cost.hasOwnProperty(cheapBuildingData.resource)

            || !game.buildings[buildingName].cost.hasOwnProperty(cheapBuildingData.resource)
        ) {
            continue;
        }

        var buildingCost = window.RedAcesUI.calcCost(
                game.buildings[buildingName].cost[cheapBuildingData.resource],
                game.buildings[buildingName].purchased
            ),
            otherCost    = window.RedAcesUI.calcCost(
                game.buildings[otherBuildingName].cost[cheapBuildingData.resource],
                game.buildings[otherBuildingName].purchased
            );

        var relation = buildingCost / otherCost;
        if (relation <= cheapBuildingData.relation) {
            // Try to build multiple cheap buildings at once
            // Lets assume the worst: A 100% cost increase per building level (=> 3)
            // Now we're solving 3^Amount = Relation / TargetRelation
            // so How many buildings can we build (with 100% cost increase) to match the target relation
            var amount = Math.max(1, Math.floor(Math.log(cheapBuildingData.relation / relation) / Math.log(3)));
            if (cheapBuildingData.hasOwnProperty('maxAmount')) {
                amount = Math.min(cheapBuildingData.maxAmount - cheapBuildingData.purchased, amount);
            }
            window.RedAcesUI.build(buildingName, amount);
        }
    }
};

/** Auto player employment */
window.RedAcesUI.autoGather = function() {
    if (!window.RedAcesUI.options.autoGather.enabled) {
        return;
    }

    if (game.global.buildingsQueue.length > 2) {
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
    } else if (game.global.buildingsQueue.length > 0) {
        setGather('buildings');
    } else {
        setGather('science');
    }
};

/** Auto pause game at a certain world level */
window.RedAcesUI.autoPause = function() {
    if (!window.RedAcesUI.options.autoPause.enabled) {
        return;
    }

    if (game.global.world >= RedAcesUI.options.autoPause.worldLevel && !game.options.menu.pauseGame.enabled) {
        toggleSetting('pauseGame');
    }
};

/** Runs a newly bought map */
window.RedAcesUI.farmMap = function(repeatUntil) {
    if (game.global.currentMapId != '') {
        // We're already running a map!
        return 'already running a map';
    }

    if (!game.global.switchToMaps && !game.global.preMapsActive) {
        // switch to maps screen and wait for it
        mapsClicked();
    }

    if (game.global.switchToMaps
        && !game.global.preMapsActive
        && ((game.resources.trimps.soldiers == 0) // Will happen on the maps screen
            || (game.global.lastClearedCell >= 95)
            || ((game.resources.trimps.realMax() - game.resources.trimps.owned) / game.resources.trimps.soldiers < 0.1)
        )
    ) {
        // skip "waiting for trimps to die" if they are > 90%
        // or its urgent
        mapsClicked();
    }

    if (!game.global.preMapsActive) {
        // Not in the maps screen now ... something has gone wrong!
        return 'not in maps screen';
    }

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

    var existingMap = window.RedAcesUI.selectMap(game.global.world);
    if (typeof existingMap !== 'undefined') {
        runMap();
    }
};

/** Selects a map of the requested level. Will use an existing one or buy a new one */
window.RedAcesUI.selectMap = function (level) {
    for (var i in game.global.mapsOwnedArray) {
        if (!game.global.mapsOwnedArray.hasOwnProperty(i)) {
            continue;
        }
        var mapObj = game.global.mapsOwnedArray[i];
        if ((mapObj.level === level) && !mapObj.noRecycle) {
            // only use maps of the requested level that are recyclable (no unique maps!)
            selectMap(mapObj.id);
            return mapObj;
        }
    }

    document.getElementById('mapLevelInput').value = level;

    // No map found -> try buying
    document.getElementById('biomeAdvMapsSelect').value     = 'Plentiful';
    document.getElementById('lootAdvMapsRange').value       = 9;
    document.getElementById('sizeAdvMapsRange').value       = 9;
    document.getElementById('difficultyAdvMapsRange').value = 9;
    adjustMap('loot', 9);
    adjustMap('size', 9);
    adjustMap('difficulty', 9);

    var buyMapResult = buyMap();
    if (buyMapResult === 1) {
        // Bought a map -> everythings fine
        return getMapIndex(game.global.lookingAtMap);
    }
    if (buyMapResult === -3) {
        // Too few fragments, try one level lower
        return window.RedAcesUI.selectMap(level - 1);
    }

    if (buyMapResult === -2) {
        document.getElementById('mapLevelInput').value = level - 5;
        recycleBelow(true);

        // try again!
        return window.RedAcesUI.selectMap(level);
    }
};

/** Runs all void maps */
window.RedAcesUI.runVoidMaps = function() {
    if (game.global.currentMapId != '') {
        // We're already running a map!
        return 'already running a map';
    }

    if (game.global.totalVoidMaps <= 0) {
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
        if (map.location === 'Void') {
            // Found one! Run it and all is good!
            selectMap(map.id);
            runMap();
            return;
        }
    }
};

window.RedAcesUI.dummyEnemyHealth = 0;
window.RedAcesUI.dummyEnemyLevel  = 0;

/**
 * get the HP of an enemy dummy
 *
 * Types:
 * 'None'  .. Nothing, not even Void Corruption!
 * 'World' .. Void Corruption
 * 'Map'   .. Void Corruption + 10% Extra difficulty
 * 'Void'  .. Void Corruption + 10% Extra difficulty + 450% Difficulty (Pits) - 15% Void Power I - 20% Void Power II
 * 'Spire' .. Special Calculation
 */
window.RedAcesUI.getDummyEnemyHealth = function (type) {
    if (type === 'Spire') {
        return getSpireStats(
            RedAcesUI.options.autoPlay.targetSpireCell,
            RedAcesUI.options.autoPlay.targetEnemy,
            'health'
        );
    }

    var health = game.global.getEnemyHealth(99, window.RedAcesUI.options.autoPlay.targetEnemy);

    if ((game.global.world > 5) && game.global.mapsActive) {
        // Maps have 10 % higher stats, we need to offset this
        health *= 0.9;
    }

    if ((window.RedAcesUI.dummyEnemyHealth < health)
        || (window.RedAcesUI.dummyEnemyLevel > game.global.world) // after portal
    ) {
        window.RedAcesUI.dummyEnemyHealth = health;
    } else {
        health = window.RedAcesUI.dummyEnemyHealth;
    }

    window.RedAcesUI.dummyEnemyLevel = game.global.world;

    if (type === 'None') {
        return health;
    }

    health *= RedAcesUI.getVoidCorruptionHealthMult(type);

    if (type === 'World') {
        // no extras
    } else if (type === 'Map') {
        health    *= 1.1;
    } else if (type === 'Void') {
        health    *= 1.1 * 4.5;
        var mapObj = getCurrentMapObject();
        if (!game.global.mapsActive || (mapObj.location !== 'Void')) {
            // Add Void Power I/II Masteries if not already in VM
            if (game.talents.voidPower.purchased) {
                health /= 1.15; // 15 % damage and health
            }
            if (game.talents.voidPower2.purchased) { // Void Power II Mastery
                health /= 1.2; // 20 % damage and health
            }
        }
    }
    return health;
};

/** Returns the min damage of your trimps */
window.RedAcesUI.getTrimpsMinDamage = function() {
    var damage = 1 * calculateDamage(game.global.soldierCurrentAttack, true, true).split('-')[0];

    if (!game.global.mapsActive) {
        damage /= (1 + game.global.mapBonus * 0.2);
    }

    if (game.global.titimpLeft > 0) {
        damage /= 2;
    }

    return damage;
};

/** Returns the avg damage of your trimps (with crits) */
window.RedAcesUI.getTrimpsAvgDamage = function() {
    var parts  = calculateDamage(game.global.soldierCurrentAttack, true, true).split('-'),
        damage = (1 * parts[0] + 1 * parts[1]) / 2;
    damage = (1 - getPlayerCritChance()) * damage + getPlayerCritChance() * damage * getPlayerCritDamageMult();

    if (!game.global.mapsActive) {
        damage /= (1 + game.global.mapBonus * 0.2);
    }

    if (game.global.titimpLeft > 0) {
        damage /= 2;
    }

    return damage;
};

/** sets the timer of the Geneticist Assist to x seconds */
window.RedAcesUI.setGeneticistAssist = function(seconds, messageSuffix) {
    if (!game.jobs.Geneticist.locked && (game.global.GeneticistassistSetting != seconds)) {
        if (game.global.GeneticistassistSteps.indexOf(seconds) === -1) {
            game.global.GeneticistassistSteps = [-1, 1, 10, seconds];
        }

        while (game.global.GeneticistassistSetting != seconds) {
            message(messageSuffix + 'Toggling GA to reach ' + seconds + ' seconds of breed time', 'Notices');
            toggleGeneticistassist();
        }
    }
};

/** calculates how much hits your trimps have to do to kill an Turtlimp on cell 99 */
window.RedAcesUI.getNumberOfHitsToKillEnemy = function(type, changeFormationTo) {
    var numHits = window.RedAcesUI.getDummyEnemyHealth(type) / window.RedAcesUI.getTrimpsAvgDamage();
    if ((typeof changeFormationTo !== 'undefined') && (game.global.formation != changeFormationTo)) {
        // Calc in X Formation
        if (game.global.formation == 1) {
            numHits /= 2;
        } else if (game.global.formation == 2) {
            numHits *= 4;
        } else if (game.global.formation == 3) {
            numHits /= 2;
        } else if (game.global.formation == 4) {
            numHits /= 2;
        }

        // Calc in target formation
        if (changeFormationTo == 1) {
            numHits *= 2;
        } else if (changeFormationTo == 2) {
            numHits /= 4;
        } else if (changeFormationTo == 3) {
            numHits *= 2;
        } else if (changeFormationTo == 4) {
            numHits *= 2;
        }
    }

    if (type === 'World') {
        numHits /= (1 + game.global.mapBonus);
    } else if (type === 'Map') {
        if (game.global.titimpLeft > 0) {
            numHits /= 2;
        }
    }

    return numHits;
};

/** Calculations the void corruption multiplicator for the health */
window.RedAcesUI.getVoidCorruptionHealthMult = function(type) {
    var corruptionStart     = 180,
        corruptionBaseLevel = 150;

    if (game.global.challengeActive === 'Corrupted') {
        corruptionStart     = 60;
        corruptionBaseLevel = 1;
    }

    // No "Void Corruption" yet
    if (game.global.world < corruptionStart) {
        return 1;
    }

    var voidCorruption = 10 * Math.pow(1.05, Math.floor((game.global.world - corruptionBaseLevel) / 6));

    // Type:
    // 'World' .. Void Corruption is applied fully
    // 'Map'   .. No Void Corruption until < 230 and then half
    // 'Void'  .. Half Void Corruption until < 230 and then full
    // 'Spire' .. Like z200 World, but irrelevant because only the lower cells have it TODO Make it spire-cell dependent??
    if (type === 'World') {
        return voidCorruption;
    } else if (type === 'Map') {
        if (game.global.world < 230) {
            // No Void Corruption for normal map enemies before 230
            return 1;
        }
        return voidCorruption / 2;
    } else if (type === 'Void') {
        if (game.global.world < 230) {
            // Before Magma its only half...
            voidCorruption /= 2;
        }
        return voidCorruption;
    } else if (type === 'Spire') {
        return 1;
    }
};

/**
 * Returns the damage needed to overkill two trimps
 *
 * if its >= 0 -> overkill!
 * if its < 0  -> no overkill!
 */
window.RedAcesUI.getNeededOverkillDamage = function(type) {
    var enemyHealth     = window.RedAcesUI.getDummyEnemyHealth(type),
        trampleDamage   = window.RedAcesUI.getTrimpsMinDamage() - enemyHealth,
        overkillPercent = game.portal.Overkill.level * 0.005;

    return (trampleDamage * overkillPercent - enemyHealth) / overkillPercent;
};

/** Calculates which formation to use */
window.RedAcesUI.getDesiredFormation = function (changeAccordingToNeeds) {
    if (game.global.mapsActive) {
        var mapObj = getCurrentMapObject();
        if (mapObj.location === 'Void') {
            // Void Map!
            // TODO Test if block is sufficient
            return RedAcesUI.options.autoPlay.voidMapFormation;
        }

        if (changeAccordingToNeeds) {
            // No Void Map!
            var numHitsInX = window.RedAcesUI.getNumberOfHitsToKillEnemy('Map', 0);
            if (numHitsInX <= 1) {
                // Use scryer if X onehits the enemies
                return 4;
            }
            if (numHitsInX > 4) {
                // Use Dominance if X needs more than 4 hits for the enemies
                return 2;
            }
        }
    }

    if (game.global.spireActive) {
        return 2; // Dominance
    }

    if (changeAccordingToNeeds
        && !game.global.mapsActive
        && (game.global.world >= RedAcesUI.options.autoPlay.scryerUntilZone)
        && game.global.gridArray.hasOwnProperty(game.global.lastClearedCell + 1)
    ) {
        var thisEnemy = game.global.gridArray[game.global.lastClearedCell + 1];
        if (!thisEnemy.hasOwnProperty('mutation') || (thisEnemy.mutation !== 'Corruption')) {
            return 4; // Scryer
        }
    }

    if (game.global.world >= RedAcesUI.options.autoPlay.dominanceUntilZone) {
        return 0; // X
    }

    if (game.global.world >= RedAcesUI.options.autoPlay.scryerUntilZone) {
        return 2; // Dominance
    }

    return 4; // Scryer
};

/** Plays the game for you */
window.RedAcesUI.autoPlay = function() {
    var opt = window.RedAcesUI.options.autoPlay;
    if (!opt.enabled) {
        // nothing to do here
        return;
    }

    var infoEnemySpan  = document.getElementById('RedAcesUIAutoPlayInfoEnemy'),
        infoDamageSpan = document.getElementById('RedAcesUIAutoPlayInfoDamage'),
        infoTargetSpan = document.getElementById('RedAcesUIAutoPlayInfoTarget');

    if (game.global.world < 10) {
        infoEnemySpan.innerHTML  = 'Starts at z10';
        infoDamageSpan.innerHTML = '';
        infoTargetSpan.innerHTML = '';
        return;
    }

    if (game.global.pauseFight) {
        // Set 'AutoFight On'
        pauseFight();
    }

    if (getAvailableGoldenUpgrades() > 0) {
        var what;
        if (game.global.world <= opt.buyGoldenVoidUntil) {
            what = 'Void';
        } else {
            what = 'Helium';
        }
        message('RA:autoPlay(): buying Golden ' + what, 'Notices');
        buyGoldenUpgrade(what);
    }

    // Auto-Stance
    var targetFormation = RedAcesUI.getDesiredFormation(true);

    if ((game.upgrades.Formations.allowed) && (game.global.formation != targetFormation) && (game.global.world >= 60)) {
        message('RA:autoPlay(): setting formation to ' + targetFormation, 'Notices');
        setFormation('' + targetFormation)
    }

    window.RedAcesUI.setGeneticistAssist(30, 'RA:autoPlay():');

    // Auto run Maps
    var targetNumHits  = 1,
        numHits        = window.RedAcesUI.getNumberOfHitsToKillEnemy('World', RedAcesUI.getDesiredFormation(false)),
        enemyText      = 'c99 ' + opt.targetEnemy;

    if (game.global.spireActive) {
        targetNumHits = opt.targetSpireNumHits;
        numHits       = RedAcesUI.getNumberOfHitsToKillEnemy('Spire', 2);
        enemyText     = 'c' + opt.targetSpireCell + ' Spire ' + opt.targetEnemy;
    } else if ((game.global.world == opt.voidMapZone)
        && (game.global.lastClearedCell >= opt.voidMapCell)
        && (game.global.totalVoidMaps > 0)
    ) {
        targetNumHits = opt.targetVoidMapNumHits;
        numHits       = window.RedAcesUI.getNumberOfHitsToKillEnemy('Void', opt.voidMapFormation);
        enemyText     = 'c99 Void ' + opt.targetEnemy;
    } else if (game.global.world < opt.overkillUntilZone) {
        var overkillDamagePlus   = window.RedAcesUI.getNeededOverkillDamage('None');
        infoEnemySpan.innerHTML  = enemyText;
        infoDamageSpan.innerHTML = 'OK: ' + prettify(overkillDamagePlus / window.RedAcesUI.getTrimpsAvgDamage() * 100) + ' %';
        infoTargetSpan.innerHTML = 'Target: > 0';

        if ((overkillDamagePlus < 0) && !game.global.mapsActive && (game.global.lastClearedCell > 0)) {
            // More than 1 hit per enemy and in no map
            if (!game.global.switchToMaps) {
                message(
                    'RA:autoPlay(): run z' + game.global.world + ' maps, need ' + prettify(Math.abs(overkillDamagePlus))
                    + ' more damage to Overkill',
                    'Notices'
                );
            }
            window.RedAcesUI.farmMap(0); // Repeat forever
            return;
        } else if ((overkillDamagePlus >= 0) && game.global.mapsActive && game.global.repeatMap) {
            // less than 1 hit per enemy, in map and "repeat on"
            message(
                'RA:autoPlay(): stop z' + game.global.world + ' maps',
                'Notices'
            );
            repeatClicked();
            return;
        }
        return;
    } else if (game.global.world >= opt.oneshotUntilZone) {
        targetNumHits = 2;
    }

    infoEnemySpan.innerHTML  = enemyText;
    infoDamageSpan.innerHTML = 'Hits: ' + prettify(numHits);
    infoTargetSpan.innerHTML = 'Target: ' + targetNumHits;

    if ((numHits > targetNumHits) && !game.global.mapsActive) {
        // More than xx hit per enemy and in no map
        if (!game.global.switchToMaps) {
            message(
                'RA:autoPlay(): run z' + game.global.world + ' maps, need ' + prettify(numHits) + ' hits per '
                + enemyText + ' (target: <= ' + targetNumHits + ')',
                'Notices'
            );
        }
        window.RedAcesUI.farmMap(0); // Repeat forever
        return;
    }

    if ((numHits <= targetNumHits) && game.global.mapsActive) {
        // less than xx hit per enemy and in map

        if (game.global.repeatMap) {
            // "Repeat on" and we're NOT in the spire with prestiges left
            message(
                'RA:autoPlay(): stop z' + game.global.world + ' maps',
                'Notices'
            );
            repeatClicked();
        }
        return;
    }

    if ((numHits <= targetNumHits)
        && !game.global.mapsActive
        && (game.global.totalVoidMaps > 0)
        && ((game.global.world == opt.voidMapZone)
            || ((game.global.world >= opt.voidMapZone) && (game.global.world <= opt.overkillUntilZone))
        )
        && (game.global.lastClearedCell >= opt.voidMapCell)
    ) {
        // We're ready for the voids!
        // TODO Toggle "Finish all Voids"

        // Build all available nurseries
        window.RedAcesUI.build('Nursery', 'Max');

        // Set generator to "Gain Magmite" because we dont need the fuel any more!
        changeGeneratorState(0);

        message('RA:autoPlay(): running z' + game.global.world + ' void maps', 'Notices');
        window.RedAcesUI.runVoidMaps();
        return;
    }
};

window.RedAcesUI.calcWarpstationStrategy = function() {
    if (!game.buildings.hasOwnProperty('Warpstation')
        || !game.upgrades.hasOwnProperty('Gigastation')
    ) {
        message(
            'Warp- or Gigastation not available',
            'Notices'
        );
        return;
    }
    var farmMinutes          = 1,
        metalPerSecondPretty = document.getElementById('metalPs').innerHTML,
        metalPerSecond       = 1 * metalPerSecondPretty.substring(1, metalPerSecondPretty.length - 4),
        metalPerMinute       = metalPerSecond * 60,

        gigastationCurrent   = game.upgrades.Gigastation.done,
        gigastationAllowed   = game.upgrades.Gigastation.allowed,

        // cost for 1 warpstation at max Gigastations
        warpstationBaseMetalCost = game.buildings.Warpstation.cost.metal[0]
            * Math.pow(1.75, gigastationAllowed - gigastationCurrent)
            * window.RedAcesUI.getArtisanistryMult()
            * window.RedAcesUI.getResourcefulMult(),

        // Amount of warpstation for 1 minute worth of metal farming
        targetWarpstationCount   = Math.log(farmMinutes * metalPerMinute / warpstationBaseMetalCost) / Math.log(game.buildings.Warpstation.cost.metal[1]),
        rawWarpstationDelta      = targetWarpstationCount / gigastationAllowed,
        warpstationDelta         = Math.floor(rawWarpstationDelta / 0.5) * 0.5,
        warpstationZero          = Math.ceil(targetWarpstationCount - warpstationDelta * gigastationAllowed);

    message(
        'With ' + farmMinutes + ' min of farming ' + metalPerSecond + ' metal per second you could afford a level '
        + prettify(targetWarpstationCount) + ' warpstation (at ' + gigastationAllowed + ' gigastations)'
        + ' so use 0+' + prettify(rawWarpstationDelta) + ' or ' + warpstationZero + '+' + warpstationDelta
        + ' strategy',
        'Notices'
    );

    if ((window.RedAcesUI.options.autoBuild.warpstationDelta == warpstationDelta)
        && (window.RedAcesUI.options.autoBuild.warpstationZero < warpstationZero)
    ) {
        window.RedAcesUI.options.autoBuild.warpstationZero = warpstationZero;

        message(
            'Updating warpstationZero, new Warpstation Strategy is '
            + window.RedAcesUI.options.autoBuild.warpstationZero + '+' + window.RedAcesUI.options.autoBuild.warpstationDelta,
            'Notices'
        );
    } else if ((window.RedAcesUI.options.autoBuild.warpstationDelta < warpstationDelta)
        && (window.RedAcesUI.options.autoBuild.warpstationZero != warpstationZero)
    ) {
        window.RedAcesUI.options.autoBuild.warpstationDelta = warpstationDelta;
        window.RedAcesUI.options.autoBuild.warpstationZero  = warpstationZero;

        message(
            'Updating warpstation strategy, new Warpstation Strategy is '
            + window.RedAcesUI.options.autoBuild.warpstationZero + '+' + window.RedAcesUI.options.autoBuild.warpstationDelta,
            'Notices'
        );
    }
    return warpstationZero + '+' + warpstationDelta;
};

/** init main loop */

window.RedAcesUI.inProcess = false;

window.RedAcesUI.mainLoop = function() {
    if (window.RedAcesUI.inProcess) {
        return;
    }
    window.RedAcesUI.inProcess = true;

    document.title = 'Trimps z' + game.global.world + '-' + (game.global.lastClearedCell + 2);
    if (getAvailableGoldenUpgrades() > 0) {
        document.title = 'GOLDEN ' + document.title;
    }

    window.RedAcesUI.autoHireTrimps();
    window.RedAcesUI.autoBuild();
    window.RedAcesUI.autoGather();
    window.RedAcesUI.displayEfficiency();
    window.RedAcesUI.autoPause();
    window.RedAcesUI.autoPlay();

    window.RedAcesUI.inProcess = false;
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
        button.className = button.className.replace('colorSuccess', 'colorDanger');
        button.className = button.className.replace('btn-danger', 'btn-success');
    } else {
        button.className = button.className.replace('colorSuccess', 'colorDanger');
        button.className = button.className.replace('btn-success', 'btn-danger');
    }

    if (what === 'autoPlay') {
        var autoPlayInfoDiv = document.getElementById('RedAcesUIAutoPlayInfo');
        if (autoPlayInfoDiv) {
            if (window.RedAcesUI.options[what].enabled) {
                autoPlayInfoDiv.style.display = 'block';
            } else {
                autoPlayInfoDiv.style.display = 'none';
            }
        }
    }
};

/** Show options buttons */
window.RedAcesUI.displayOptions = function() {
    var displayButton = function (what, label, where, fullSize, onclickCallback) {
        var button          = document.createElement('div');
        button.innerHTML    = label;

        if (window.RedAcesUI.options.hasOwnProperty(what)) {
            if (window.RedAcesUI.options[what].enabled) {
                button.className = 'pointer noselect colorSuccess';
            } else {
                button.className = 'pointer noselect colorDanger';
            }

            button.id           = 'RedAcesUIOpt' + what;
        } else {
            button.className = 'pointer noselect';
        }
        if (onclickCallback) {
            button.onclick = onclickCallback;
        } else {
            button.onclick = function () {
                window.RedAcesUI.toggleAutomation(what);
            };
        }

        button.style.border   = '1px solid white';
        button.style.padding  = '0 5px';
        button.style.fontSize = '0.9vw';

        if (fullSize) {
            where.innerHTML      = '';
        } else {
            button.style.display = 'inline';
        }
        where.appendChild(button);

        return button;
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
        displayButton('autoBuild', 'AutoBuild', buildingsTitleDiv.childNodes[1].childNodes[3], false);

        displayButton(
            'calcWSStrat',
            'Warpstation Strat',
            buildingsTitleDiv.childNodes[1].childNodes[3],
            false,
            window.RedAcesUI.calcWarpstationStrategy
        );
    }

    // Auto Play
    var battleBtnsColumn = document.getElementById('battleBtnsColumn');
    if (battleBtnsColumn) {
        // Toggle auto play
        var toggleBtn        = document.createElement('span'),
            toggleBtnWrapper = document.createElement('div');

        if (window.RedAcesUI.options.autoPlay.enabled) {
            toggleBtn.className = 'btn btn-success fightBtn';
        } else {
            toggleBtn.className = 'btn btn-danger fightBtn';
        }

        toggleBtn.id        = 'RedAcesUIOpt' + 'autoPlay';
        toggleBtn.innerHTML = 'AutoPlay';
        toggleBtn.onclick   = function () {
            window.RedAcesUI.toggleAutomation('autoPlay');
        };

        toggleBtnWrapper.className = 'battleSideBtnContainer';

        toggleBtnWrapper.appendChild(toggleBtn);
        battleBtnsColumn.appendChild(toggleBtnWrapper);

        // Display info
        var infoDiv             = document.createElement('div');
        infoDiv.className       = 'battleSideBtnContainer';
        infoDiv.id              = 'RedAcesUIAutoPlayInfo';
        infoDiv.innerHTML       = '<strong>AutoPlay Info</strong>'
            + '<br/><span id="RedAcesUIAutoPlayInfoEnemy"></span>'
            + '<br/><span id="RedAcesUIAutoPlayInfoDamage"></span>'
            + '<br/><span id="RedAcesUIAutoPlayInfoTarget"></span>';
        infoDiv.style.padding      = '2px 5px';
        infoDiv.style.border       = '1px solid black';
        infoDiv.style.borderRadius = '2px';
        infoDiv.style.textAlign    = 'center';

        if (!window.RedAcesUI.options.autoPlay.enabled) {
            infoDiv.style.display = 'none';
        }

        battleBtnsColumn.appendChild(infoDiv);
    }
};

window.RedAcesUI.displayOptions();

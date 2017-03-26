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
        "warpstationZero":     5,
        "warpstationDelta":  5.5,
        "buildings": {
            "Gym":            -1,
            "Tribute":        -1,
            "Collector":      41,
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
        "enabled":         true,
        "voidMapZone":      190,
        "endZone":          210,
        "buyGolden":   'Helium'
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
            cost         = window.RedAcesUI.calcCost(data.cost[resource], data.level) * costMult,
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
                    + prettify(items[stat][i].costPerValue / bestStatEfficiency * 100) + '%)</span>';
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

        if ((jobName == 'Farmer') && (targetJobEmployees > 100)) {
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
        var cheapBuildingData = window.RedAcesUI.options.autoBuild.cheapBuildings[buildingName],
            otherBuildingName = cheapBuildingData.otherBuilding;

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
    if (existingMap !== undefined) {
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

window.RedAcesUI.dummyEnemyHealth = 0;
window.RedAcesUI.dummyEnemyLevel  = 0;

/** get the HP of an enemy dummy */
window.RedAcesUI.getDummyEnemyHealth = function () {
    var health = game.global.getEnemyHealth(99, 'Turtlimp');

    if (game.global.world > 5 && game.global.mapsActive) {
        // Maps have 10 % higher stats, we need to offset this
        health /= 1.1;
    }

    if ((window.RedAcesUI.dummyEnemyHealth < health)
        || (window.RedAcesUI.dummyEnemyLevel > game.global.world) // after portal
    ) {
        window.RedAcesUI.dummyEnemyHealth = health;
    }

    window.RedAcesUI.dummyEnemyLevel = game.global.world;

    // message('Enemy health at z' + game.global.world + ': ' + prettify(window.RedAcesUI.dummyEnemyHealth), 'Notices');

    return window.RedAcesUI.dummyEnemyHealth;
};

/** sets the timer of the Geneticist Assist to seconds */
window.RedAcesUI.setGeneticistAssist = function(seconds, messageSuffix) {
    if (!game.jobs.Geneticist.locked && (game.global.GeneticistassistSetting != seconds)) {
        if (game.global.GeneticistassistSteps.indexOf(seconds) == -1) {
            game.global.GeneticistassistSteps = [-1, 1, 10, seconds];
        }

        while (game.global.GeneticistassistSetting != seconds) {
            message(messageSuffix + 'Toggling GA to reach ' + seconds + ' seconds of breed time', 'Notices');
            toggleGeneticistassist();
        }
    }
};

/** calculates how much hits your trimps have to do to kill an Turtlimp on cell 99 */
window.RedAcesUI.getNumberOfHitsToKillEnemy = function() {
    var trimpMinDamage = 1 * calculateDamage(game.global.soldierCurrentAttack, true, true).split('-')[0];

    return window.RedAcesUI.getDummyEnemyHealth() / trimpMinDamage;
};

/**
 * Returns the damage plus after overkilling two trimps
 *
 * if its >= 0 -> overkill!
 * if its < 0  -> no overkill!
 */
window.RedAcesUI.getOverkillDamagePlus = function() {
    var trimpMinDamage = 1 * calculateDamage(game.global.soldierCurrentAttack, true, true).split('-')[0],
        enemyHealth    = window.RedAcesUI.getDummyEnemyHealth(),
        trampleDamage  = trimpMinDamage - enemyHealth;

    return trampleDamage * game.portal.Overkill.level * 0.005 - enemyHealth;
};

/** Plays the game for you */
window.RedAcesUI.autoPlay = function() {
    var opt = window.RedAcesUI.options.autoPlay;
    if (!opt.enabled || (game.global.world < 10)) {
        // nothing to do here
        return;
    }

    if (game.global.pauseFight) {
        // Set 'AutoFight On'
        pauseFight();
    }

    if (getAvailableGoldenUpgrades() > 0) {
        message('RA:autoPlay(): buying Golden ' + opt.buyGolden, 'Notices');
        buyGoldenUpgrade(opt.buyGolden);
    }

    // Auto-Stance
    var mapObj          = getCurrentMapObject(),
        targetFormation = 4; // Scryer

    if (((mapObj !== undefined) && (mapObj.location === 'Void'))
        || ((mapObj === undefined) && (game.global.world === 200) && (game.global.spireActive))
    ) {
        targetFormation = 2; // Dominance
    }

    if ((game.upgrades.Formations.allowed) && (game.global.formation !== targetFormation) && (game.global.world >= 60)) {
        message('RA:autoPlay(): setting formation to ' + targetFormation, 'Notices');
        setFormation(targetFormation)
    }

    if (game.global.world < (opt.voidMapZone - 1)) {
        window.RedAcesUI.setGeneticistAssist(10, 'RA:autoPlay():');
    } else {
        window.RedAcesUI.setGeneticistAssist(30, 'RA:autoPlay():');
    }

    var numHits = window.RedAcesUI.getNumberOfHitsToKillEnemy();

    // Auto run Maps

    if (game.global.spireActive) {
        // TODO Calc if we're one hitting the spire enemies: getSpireStats(cellNum, name, 'Health')
        if (mapObj === undefined) {
            if (addSpecials(true, true, null, true).length > 0) {
                // We're in the spire and have prestiges left to farm!!
                message('RA:autoPlay(): running z' + game.global.world + ' maps for all prestiges (bc of spire!)', 'Notices');
                window.RedAcesUI.runNewMap(2); // Repeat for items
                return;
            }
            if (game.global.mapBonus < 10) {
                // We're in the spire and have prestiges left to farm!!
                message('RA:autoPlay(): running z' + game.global.world + ' maps for stacking damage bonus', 'Notices');
                window.RedAcesUI.runNewMap(1); // Repeat to 10
                return;
            }
        }
        return;
    }

    if (game.global.world == opt.voidMapZone) {
        // TODO Calc if we're one hitting the void map enemies
        if (mapObj === undefined) {
            if (addSpecials(true, true, null, true).length > 0) {
                // We're in the voidMapZone and have prestiges left to farm!!
                message('RA:autoPlay(): running z' + game.global.world + ' maps for all prestiges (bc of void maps!)', 'Notices');
                window.RedAcesUI.runNewMap(2); // Repeat for items
                return;
            }

            if (game.global.totalVoidMaps > 0) {
                // We're ready for the voids!
                message('RA:autoPlay(): running z' + game.global.world + ' void maps', 'Notices');
                window.RedAcesUI.runVoidMaps();
                return;
            }
        }
        return;
    }

    if (game.global.world < (opt.voidMapZone - 5)) {
        var overkillDamagePlus = window.RedAcesUI.getOverkillDamagePlus();
        if ((overkillDamagePlus < 0) && (mapObj === undefined) && (game.global.lastClearedCell > 0)) {
            // More than 1 hit per enemy and in no map
            message(
                'RA:autoPlay(): running z' + game.global.world + ' maps to farm because we need '
                + prettify(Math.abs(overkillDamagePlus)) + ' more damage to overkill things',
                'Notices'
            );
            window.RedAcesUI.runNewMap(0); // Repeat forever
            return;
        } else if ((overkillDamagePlus >= 0) && (mapObj !== undefined) && game.global.repeatMap) {
            // less than 1 hit per enemy, in map and "repeat on"
            message(
                'RA:autoPlay(): stop running z' + game.global.world + ' maps to farm because we have '
                + prettify(overkillDamagePlus) + ' too much damage after overkilling things',
                'Notices'
            );
            repeatClicked();
            return;
        }
        return;
    } else { // game.global.world > (opt.voidMapZone - 5)
        var targetNumHits = 1;
        if (game.global.world > (opt.endZone - 5)) {
            targetNumHits = 2;
        }

        if ((numHits > targetNumHits) && (mapObj === undefined)) {
            // More than 1 hit per enemy and in no map
            message(
                'RA:autoPlay(): running z' + game.global.world + ' maps to farm because we need '
                + prettify(numHits) + ' hits per c99 Turtlimp',
                'Notices'
            );
            window.RedAcesUI.runNewMap(0); // Repeat forever
        } else if ((numHits <= targetNumHits) && (mapObj !== undefined) && game.global.repeatMap) {
            // less than 1 hit per enemy, in map and "repeat on"
            message(
                'RA:autoPlay(): stop running z' + game.global.world + ' maps to farm because we need '
                + prettify(numHits) + ' hits per c99 Turtlimp',
                'Notices'
            );
            repeatClicked();
        }
        return;
    }
};

window.RedAcesUI.calcWarpstationStrategy = function() {
    if (!game.buildings.hasOwnProperty('Warpstation')
        || !game.upgrades.hasOwnProperty('Gigastation')
    ) {
        return 'warp- or gigastation not available';
    }
    var metalPerSecondPretty = document.getElementById('metalPs').innerHTML,
        metalPerSecond       = 1 * metalPerSecondPretty.substring(1, metalPerSecondPretty.length - 4),
        metalPerMinute       = metalPerSecond * 60,

        gigastationCurrent   = game.upgrades.Gigastation.done,
        gigastationAllowed   = game.upgrades.Gigastation.allowed,

        // cost for 1 warpstation at max gigastation
        warpstationBaseMetalCost = game.buildings.Warpstation.cost.metal[0] * Math.pow(1.75, gigastationAllowed - gigastationCurrent) * window.RedAcesUI.getArtisanistryMult() * window.RedAcesUI.getResourcefulMult(),

        // Amount of warpstation for 5 minutes worth of metal farming
        targetWarpstationCount   = Math.log(2 * metalPerMinute / warpstationBaseMetalCost) / Math.log(game.buildings.Warpstation.cost.metal[1]),
        rawWarpstationDelta      = targetWarpstationCount / gigastationAllowed,
        warpstationDelta         = Math.floor(rawWarpstationDelta / 0.5) * 0.5,
        warpstationZero          = Math.ceil(targetWarpstationCount - warpstationDelta * gigastationAllowed);

    message(
        'With 2 mins of farming ' + metalPerSecond + ' metal per second you could afford a level '
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
    } else if (window.RedAcesUI.options.autoBuild.warpstationDelta <= warpstationDelta) {
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
    window.RedAcesUI.autoPlay();

    document.getElementById('metalPs').innerHTML.substring(1, document.getElementById('metalPs').innerHTML.length - 4)
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

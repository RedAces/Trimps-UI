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

RedAcesUI         = {};
RedAcesUI.options = {
    "autoBuild": {
        "enabled":          true,
        "warpstationZero":     7,
        "warpstationDelta":  7.5,
        "buildings": {
            "Gym":            -1,
            "Tribute":        -1,
            "Collector":      50,
            "Gateway":        25,
            "Resort":         50,
            "Hotel":          75,
            "Mansion":       100,
            "House":         100,
            "Hut":           100,
            "Nursery":       500
        },
        "cheapBuildings": {
            "Collector": {
                "otherBuilding": "Warpstation",
                "resource":             "gems",
                "relation":                0.1
            }
        },
        "buildByZone": {
            "Nursery": {
                "buildPerZone":     50,
                "startAmount":     500,
                "maxAmount":      2900
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
        "enabled":                         true,
        "geneticistAssist":                  30, // TODO automatisch berechnen? Logik?
        "buyGoldenVoidUntil":               290,
        "recycleHeirloomsWorseThan":          7, // 7 .. "Magmatic"
        "targetEnemy":               'Turtlimp',
        "healthBuffer":                      35, // Farm enough to withstand x blows / pierces
        "gainMagmiteZoneOffset":              2, // How many zones before voidMapZone should we set the generator to "Gain Mi"?

        // Void Maps Zone (VMZ) Configuration
        // Before VMZ - 10: OK in Scryer
        // Until  VMZ - 5 : 1 - Hit in Scryer
        // Until  VMZ     : 1 - Hit in Dominance
        // VMs in VMZ     : 2 - Hit in Dominance (see "targetVoidMapNumHits" and "voidMapFormation")
        // Until  VMZ + 5 : 1 - Hit in Dominance
        // After  VMZ + 5 : 2 - Hit in Dominance
        "voidMapZone":                      320,
        "voidMapCell":                       90,
        "targetVoidMapNumHits":               1,
        "voidMapFormation":                   2, // Dominance

        // Spire
        "targetSpireCell":                   99,
        "targetSpireNumHits":                 1
    }
};

/** Prestige efficiency calculation */

RedAcesUI.attackAfterPrestige = function(base, prestige) {
    if (prestige <= 0) {
        // prestige == 0 => no prestige (so Prestige I)
        return base;
    }
    // prestige == 2 => prestiged 2 times (so Prestige III)
    return base * 11.51 * Math.pow(9.59, prestige - 1);
};

RedAcesUI.healthAfterPrestige = function(base, prestige) {
    if (prestige <= 0) {
        // prestige == 0 => no prestige (so Prestige I)
        return base;
    }
    // prestige == 2 => prestiged 2 times (so Prestige III)
    return base * 13.61 * Math.pow(11.42, prestige - 1);
};

/** Buy x equipment levels */
RedAcesUI.buyEquipment = function(equipmentName, amount) {
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
RedAcesUI.getArtisanistryMult = function() {
    return Math.pow(1 - game.portal.Artisanistry.modifier, game.portal.Artisanistry.level);
};

/** calculates the Resourceful multiplicator for all structures */
RedAcesUI.getResourcefulMult = function() {
    return Math.pow(1 - game.portal.Resourceful.modifier, game.portal.Resourceful.level);
};

/** calculates the cost for all thingies (without cost mult!) */
RedAcesUI.calcCost = function(cost, level) {
    // e. g. RedAcesUI.calcCost(game.buildings.Warpstation.cost.metal, 100)
    return cost[0] * Math.pow(cost[1], level);
};

/** Equipment efficiency */
RedAcesUI.displayEfficiency = function () {
    if (!RedAcesUI.options.displayEfficiency.enabled && !RedAcesUI.options.autoBuyEquipment.enabled) {
        return;
    }
    var costMult = RedAcesUI.getArtisanistryMult(),
        items    = {"health": [], "attack": []},
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
            stat = 'attack';
        } else if (data.hasOwnProperty('healthCalculated')) {
            gain = data.healthCalculated;
            stat = 'health';
        } else {
            continue;
        }

        if (Object.keys(data.cost).length > 1) {
            continue;
        }

        var resource     = Object.keys(data.cost)[0],
            cost         = RedAcesUI.calcCost(data.cost[resource], data.level) * costMult,
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
            stat = 'attack';
            gain = RedAcesUI.attackAfterPrestige(equipData.attack, upgradeData.done + 1);
        } else if (equipData.hasOwnProperty('health')) {
            stat = 'health';
            gain = RedAcesUI.healthAfterPrestige(equipData.health, upgradeData.done + 1);
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

            if (RedAcesUI.options.displayEfficiency.enabled) {
                var itemElement = document.getElementById(itemName);
                if (typeof itemElement === 'undefined') {
                    continue;
                }

                if (i == 0) {
                    itemElement.style.borderColor = 'lightgreen';
                    itemElement.style.color       = 'lightgreen';
                } else if (items[stat][i].costPerValue / bestStatEfficiency < RedAcesUI.options.autoBuyEquipment.maxRelEfficiency) {
                    itemElement.style.borderColor = 'yellow';
                    itemElement.style.color       = 'yellow';
                } else {
                    itemElement.style.borderColor = 'white';
                    itemElement.style.color       = 'white';
                }
            }

            if (RedAcesUI.options.autoBuyEquipment.enabled
                && game.equipment.hasOwnProperty(itemName)
                && game.global.hasOwnProperty('autoPrestiges')
                && ((game.global.autoPrestiges == 1)
                    || (((game.global.autoPrestiges == 2) || (game.global.autoPrestiges == 3)) && (stat == 'attack')))
            ) {
                // 1 ... Auto-Prestige "all"
                // 2 ... Auto-Prestige "Weapons Only" -> Auto Buy Weapons only
                // 3 ... Auto-Prestige "Weapons First" -> Auto Buy Weapons only

                equipData = game.equipment[itemName];
                if (items[stat][i].costPerValue / bestStatEfficiency < RedAcesUI.options.autoBuyEquipment.maxRelEfficiency) {
                    if (itemPrestiges.hasOwnProperty(itemName)
                        && (itemPrestiges[itemName].allowed > itemPrestiges[itemName].done)
                        && (equipData.level < RedAcesUI.options.autoBuyEquipment.maxLevelPrestigeAvailable)
                    ) {
                        // there is a prestige available
                        RedAcesUI.buyEquipment(itemName, 1);
                    } else if (equipData.level < RedAcesUI.options.autoBuyEquipment.maxLevelPrestigeUnavailable) {
                        RedAcesUI.buyEquipment(itemName, 1);
                    }
                }
            }
        }
    }

    // Special case: Shield
    if (game.equipment.hasOwnProperty('Shield')
        && !game.equipment.Shield.locked
        && (game.equipment.Shield.level < RedAcesUI.options.autoBuyEquipment.maxLevelPrestigeAvailable)
        && (game.global.hasOwnProperty('autoPrestiges'))
        && (game.global.autoPrestiges == 1) // Auto-Prestige "all"
    ) {
        RedAcesUI.buyEquipment('Shield', 1);
    }
};

/** Hires x trimps for a job */
RedAcesUI.hire = function(jobName, amount) {
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
RedAcesUI.autoHireTrimps = function() {
    if (!RedAcesUI.options.autoHireTrimps.enabled) {
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
        && RedAcesUI.options.autoHireTrimps.fireAllForVoids
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
    } else if (game.global.world <= 230) {
        jobRatios   = {
            "Miner":      100,
            "Lumberjack":  50,
            "Farmer":      10,
            "Scientist":    1
        };
        jobRatioSum = 161;
    } else {
        jobRatios   = {
            "Miner":      100,
            "Lumberjack":  10,
            "Farmer":      10,
            "Scientist":    0
        };
        jobRatioSum = 120;
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

    RedAcesUI.hire('Trainer',     'Max');
    RedAcesUI.hire('Magmamancer', 'Max');
    RedAcesUI.hire('Explorer',    1500 - game.jobs.Explorer.owned); // Max 1500

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

        RedAcesUI.hire(jobName, Math.floor(targetJobEmployees - jobEmployees));
    }
};

/** Build x buildings */
RedAcesUI.build = function(buildingName, amount) {
    if (!game.buildings.hasOwnProperty(buildingName) || game.buildings[buildingName].locked) {
        return;
    }
    if (amount === 'Max') {
        setGather('buildings');
    } else {
        amount = Math.min(amount, calculateMaxAfford(game.buildings[buildingName], true, false, false, true));
        if (amount <= 0) {
            return;
        }
        if (amount > 3) {
            setGather('buildings');
        }
    }
    var currentBuyAmount = game.global.buyAmt;
    game.global.buyAmt   = amount;
    buyBuilding(buildingName, false, true);
    game.global.buyAmt   = currentBuyAmount;
};

/** Auto building Buildings */
RedAcesUI.autoBuild = function() {
    if (!RedAcesUI.options.autoBuild.enabled) {
        return;
    }

    for (var buildingName in RedAcesUI.options.autoBuild.buildings) {
        if (!RedAcesUI.options.autoBuild.buildings.hasOwnProperty(buildingName)
            || !game.buildings.hasOwnProperty(buildingName)
        ) {
            continue;
        }

        var buildingMax    = RedAcesUI.options.autoBuild.buildings[buildingName],
            currentAmount  = game.buildings[buildingName].purchased;

        if (buildingMax === -1) {
            RedAcesUI.build(buildingName, "Max");
        } else if (buildingMax > currentAmount) {
            RedAcesUI.build(buildingName, buildingMax - currentAmount);
        }
    }

    if (game.upgrades.hasOwnProperty('Gigastation') && game.buildings.hasOwnProperty('Warpstation')) {
        var currentGigastation = game.upgrades.Gigastation.done,
            currentWarpstation = game.buildings.Warpstation.purchased,
            warpstationLimit   = RedAcesUI.options.autoBuild.warpstationZero
                + RedAcesUI.options.autoBuild.warpstationDelta * currentGigastation;

        if (currentWarpstation < warpstationLimit) {
            RedAcesUI.build('Warpstation', warpstationLimit - currentWarpstation);
        } else if (!game.upgrades.Gigastation.locked) {
            buyUpgrade('Gigastation', true, true);
        }
    }

    for (buildingName in RedAcesUI.options.autoBuild.cheapBuildings) {
        if (!RedAcesUI.options.autoBuild.cheapBuildings.hasOwnProperty(buildingName)
            || !game.buildings.hasOwnProperty(buildingName)
            || game.buildings[buildingName].locked
        ) {
            continue;
        }

        var cheapBuildingData = RedAcesUI.options.autoBuild.cheapBuildings[buildingName],
            otherBuildingName = cheapBuildingData.otherBuilding;

        if (cheapBuildingData.hasOwnProperty('untilWorldZone')
            && (game.global.world > cheapBuildingData.untilWorldZone)
        ) {
            continue;
        }

        if (cheapBuildingData.hasOwnProperty('maxAmount')
            && (game.buildings[buildingName].purchased >= cheapBuildingData.maxAmount)
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

        var buildingCost = RedAcesUI.calcCost(
            game.buildings[buildingName].cost[cheapBuildingData.resource],
            game.buildings[buildingName].purchased
            ),
            otherCost    = RedAcesUI.calcCost(
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
                amount = Math.min(cheapBuildingData.maxAmount - game.buildings[buildingName].purchased, amount);
            }
            RedAcesUI.build(buildingName, amount);
        }
    }

    for (buildingName in RedAcesUI.options.autoBuild.buildByZone) {
        if (!RedAcesUI.options.autoBuild.buildByZone.hasOwnProperty(buildingName)
            || !game.buildings.hasOwnProperty(buildingName)
            || game.buildings[buildingName].locked
        ) {
            continue;
        }

        var buildingData   = RedAcesUI.options.autoBuild.buildByZone[buildingName],
            zones          = (buildingData.maxAmount - buildingData.startAmount) / buildingData.buildPerZone,
            startWorldZone = RedAcesUI.options.autoPlay.voidMapZone - zones;
        if (game.global.world < startWorldZone) {
            continue;
        }
        var targetAmount = buildingData.startAmount + (game.global.world - startWorldZone) * buildingData.buildPerZone;

        targetAmount = Math.min(targetAmount, buildingData.maxAmount);

        RedAcesUI.build(buildingName, targetAmount - game.buildings[buildingName].purchased);
    }
};

/** Auto player employment */
RedAcesUI.autoGather = function() {
    if (!RedAcesUI.options.autoGather.enabled) {
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
RedAcesUI.autoPause = function() {
    if (!RedAcesUI.options.autoPause.enabled) {
        return;
    }

    if (game.global.world >= RedAcesUI.options.autoPause.worldLevel && !game.options.menu.pauseGame.enabled) {
        toggleSetting('pauseGame');
    }
};

/** Runs a newly bought map */
RedAcesUI.farmMap = function(repeatUntil) {
    if (game.global.mapsActive) {
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

    while (game.options.menu.exitTo.enabled != 1) { // 1 ... "Exit to World"
        toggleSetting('exitTo')
    }

    var existingMap = RedAcesUI.selectMap(game.global.world);
    if (typeof existingMap !== 'undefined') {
        runMap();
    }
};

/** Selects a map of the requested level. Will use an existing one or buy a new one */
RedAcesUI.selectMap = function (level) {
    var mapObj = getCurrentMapObject();
    if (typeof mapObj !== 'undefined') {
        return mapObj;
    }

    for (var i in game.global.mapsOwnedArray) {
        if (!game.global.mapsOwnedArray.hasOwnProperty(i)) {
            continue;
        }
        mapObj = game.global.mapsOwnedArray[i];
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
        return RedAcesUI.selectMap(level - 1);
    }

    if (buyMapResult === -2) {
        document.getElementById('mapLevelInput').value = level - 5;
        recycleBelow(true);

        // try again!
        return RedAcesUI.selectMap(level);
    }
};

/** Runs all void maps */
RedAcesUI.runVoidMaps = function() {
    if (game.global.mapsActive) {
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

    while (game.options.menu.exitTo.enabled != 1) { // 1 ... "Exit to World"
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

RedAcesUI.dummyEnemy = {
    'attack': {
        'level': 0,
        'value': 0
    },
    'health': {
        'level': 0,
        'value': 0
    }
};

/**
 * Calcs the Attack / Health of an enemy dummy
 *
 * type:
 * 'None'  .. Nothing, not even Void Corruption!
 * 'World' .. Void Corruption
 * 'Map'   .. Void Corruption + 10% Extra difficulty
 * 'Void'  .. Void Corruption + 10% Extra difficulty + 450% Difficulty (Pits)
 * 'Spire' .. Special Calculation
 *
 * stat:
 * 'health', 'attack'
 */
RedAcesUI.calcDummyEnemyStat = function (type, stat) {
    if (type === 'Spire') {
        return getSpireStats(
            RedAcesUI.options.autoPlay.targetSpireCell,
            RedAcesUI.options.autoPlay.targetEnemy,
            stat
        );
    }

    var value;
    if (stat === 'health') {
        value = game.global.getEnemyHealth(99, RedAcesUI.options.autoPlay.targetEnemy);
    } else if (stat === 'attack') {
        value = game.global.getEnemyAttack(99, RedAcesUI.options.autoPlay.targetEnemy);
    }

    if ((game.global.world > 5) && game.global.mapsActive) {
        // Maps have 10 % higher stats, we need to offset this
        value *= 0.9;
    }

    if ((RedAcesUI.dummyEnemy[stat].value < value)
        || (RedAcesUI.dummyEnemy[stat].level > game.global.world) // after portal
    ) {
        RedAcesUI.dummyEnemy[stat].value = value;
    } else {
        value = RedAcesUI.dummyEnemy[stat].value;
    }

    RedAcesUI.dummyEnemy[stat].level = game.global.world;

    if (type === 'None') {
        return value;
    }

    value *= RedAcesUI.getVoidCorruptionMult(type, stat);

    if (type === 'Map') {
        value *= 1.1;
    } else if (type === 'Void') {
        value *= 1.1 * 4.5;
    }
    return value;
};

/** Returns the min attack of your trimps */
RedAcesUI.getTrimpsMinAttack = function(changeFormationTo) {
    var attack = 1 * calculateDamage(game.global.soldierCurrentAttack, true, true).split('-')[0];

    if (!game.global.mapsActive) {
        attack /= (1 + game.global.mapBonus * 0.2);
    }

    if (game.global.titimpLeft > 0) {
        attack /= 2;
    }

    attack = attack
        / RedAcesUI.getFormationBonus(game.global.formation, 'attack')
        * RedAcesUI.getFormationBonus(changeFormationTo, 'attack');

    return attack;
};

/** Returns the avg attack of your trimps (optionally with crits) */
RedAcesUI.getTrimpsAvgAttack = function(crits, changeFormationTo) {
    var parts  = calculateDamage(game.global.soldierCurrentAttack, true, true).split('-'),
        attack = (1 * parts[0] + 1 * parts[1]) / 2;

    if (crits) {
        attack = (1 - getPlayerCritChance()) * attack + getPlayerCritChance() * attack * getPlayerCritDamageMult();
    }

    if (!game.global.mapsActive) {
        attack /= (1 + game.global.mapBonus * 0.2);
    }

    if (game.global.titimpLeft > 0) {
        attack /= 2;
    }

    attack = attack
        / RedAcesUI.getFormationBonus(game.global.formation, 'attack')
        * RedAcesUI.getFormationBonus(changeFormationTo, 'attack');

    return attack;
};

/** sets the timer of the Geneticist Assist to x seconds */
RedAcesUI.setGeneticistAssist = function(seconds, messageSuffix) {
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

/** Gets the bonus multiplier of a specific formation for a specific stat */
RedAcesUI.getFormationBonus = function(formation, stat) {
    if (formation == 0) {
        // X
        return 1;
    }

    if (stat === 'health') {
        if (formation == 1) {
            // Heap
            return 4;
        } else {
            // Dominance, Barrier, Scryer
            return 1 / 2;
        }
    } else if (stat === 'attack') {
        if (formation == 2) {
            // Dominance
            return 4;
        } else {
            // Heap, Barrier, Scryer
            return 1 / 2;
        }
    } else if (stat === 'block') {
        if (formation == 3) {
            // Barrier
            return 4;
        } else {
            // Heap, Dominance, Scryer
            return 1 / 2;
        }
    }

    return 1;
};

/** Calculates the void corruption multiplicator for a specific stat */
RedAcesUI.getVoidCorruptionMult = function(type, stat) {
    var corruptionStart     = 180,
        corruptionBaseLevel = 150,
        baseMult            = 1;

    if (game.global.challengeActive === 'Corrupted') {
        corruptionStart     = 60;
        corruptionBaseLevel = 1;
    }

    // No "Void Corruption" yet
    if ((game.global.world < corruptionStart) || (type === 'Spire')) {
        return 1;
    }

    if (stat === 'attack') {
        baseMult = 10;
    } else if (stat === 'health') {
        baseMult = 3;
    }

    var voidCorruption = baseMult * Math.pow(1.05, Math.floor((game.global.world - corruptionBaseLevel) / 6));

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
    }
};

/** Returns the attack needed to overkill two trimps of a specific type */
RedAcesUI.getNeededOverkillAttack = function(type) {
    return RedAcesUI.calcDummyEnemyStat(type, 'health') * (1 + 1 / (game.portal.Overkill.level * 0.005));
};

/** Calculates which formation to use */
RedAcesUI.getDesiredFormation = function (changeAccordingToNeeds) {
    if (game.global.mapsActive) {
        var mapObj = getCurrentMapObject();
        if (mapObj.location === 'Void') {
            // Void Map!
            return RedAcesUI.options.autoPlay.voidMapFormation;
        }

        if (changeAccordingToNeeds) {
            // No Void Map!
            var attack = RedAcesUI.getTrimpsAvgAttack(true, 4); // Scryer

            if (RedAcesUI.calcDummyEnemyStat('Map', 'health') / attack <= 2) {
                // Use scryer if it would twohit the enemies
                return 4;
            }
            // Use Dominance otherwise
            return 2;
        }
    }

    if (game.global.spireActive) {
        return 2; // Dominance
    }

    if (game.global.world < (RedAcesUI.options.autoPlay.voidMapZone - 5)) {
        return 4; // Scryer
    }

    if (changeAccordingToNeeds
        && !game.global.mapsActive
        && game.global.gridArray.hasOwnProperty(game.global.lastClearedCell + 1)
    ) {
        var thisEnemy = game.global.gridArray[game.global.lastClearedCell + 1];
        if (!thisEnemy.hasOwnProperty('mutation') || (thisEnemy.mutation !== 'Corruption')) {
            return 4; // Scryer
        }
    }

    return 2; // Dominance
};

/** Recycles (at most 1) heirloom whose rarity is bad */
RedAcesUI.autoRecycleHeirloom = function() {
    for (var i in game.global.heirloomsExtra) {
        if (!game.global.heirloomsExtra.hasOwnProperty(i)) {
            continue;
        }
        var heirloom = game.global.heirloomsExtra[i];
        if (heirloom.rarity < RedAcesUI.options.autoPlay.recycleHeirloomsWorseThan) {
            message('RA:autoPlay(): recycling ' + heirloom.name, 'Notices');
            game.global.selectedHeirloom = [i, 'heirloomsExtra'];
            recycleHeirloom(true);

            // Only recycle one heirloom at a time because the indexes will change because of it!
            return;
        }
    }
};

/** Plays the game for you */
RedAcesUI.autoPlay = function() {
    var opt = RedAcesUI.options.autoPlay;
    if (!opt.enabled) {
        // nothing to do here
        return;
    }

    var infoEnemySpan  = document.getElementById('RedAcesUIAutoPlayInfoEnemy'),
        infoAttackSpan = document.getElementById('RedAcesUIAutoPlayInfoAttack'),
        infoHealthSpan = document.getElementById('RedAcesUIAutoPlayInfoHealth');

    if (game.global.world < 10) {
        infoEnemySpan.innerHTML  = 'Starts at z10';
        infoAttackSpan.innerHTML = '';
        infoHealthSpan.innerHTML = '';
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
            if (parseFloat((game.goldenUpgrades.Void.currentBonus + game.goldenUpgrades.Void.nextAmt()).toFixed(2)) > 0.60) {
                what = 'Helium';
            }
        } else {
            what = 'Helium';
        }

        message('RA:autoPlay(): buying Golden ' + what, 'Notices');
        buyGoldenUpgrade(what);
    }

    // Auto-Stance
    var targetFormation     = RedAcesUI.getDesiredFormation(true),
        targetFormationBase = RedAcesUI.getDesiredFormation(false);

    if ((game.upgrades.Formations.allowed) && (game.global.formation != targetFormation) && (game.global.world >= 60)) {
        message('RA:autoPlay(): setting formation to ' + targetFormation, 'Notices');
        setFormation('' + targetFormation)
    }

    RedAcesUI.setGeneticistAssist(opt.geneticistAssist, 'RA:autoPlay():');

    if ((game.global.world >= (opt.voidMapZone - opt.gainMagmiteZoneOffset))
        && (game.global.world <= opt.voidMapZone)
        && (game.global.generatorMode != 0)
    ) {
        message('RA:autoPlay(): setting Dimensional Generator to "Gain Magmite".', 'Notices');
        changeGeneratorState(0);
    }

    RedAcesUI.autoRecycleHeirloom();

    // Auto run Maps

    var enemyText,
        currentAttack = RedAcesUI.getTrimpsAvgAttack(true, targetFormationBase),
        currentHealth = game.global.soldierHealthMax
            / RedAcesUI.getFormationBonus(game.global.formation, 'health')
            * RedAcesUI.getFormationBonus(targetFormationBase, 'health'),
        healthBuffer  = opt.healthBuffer,
        targetAttack,
        enemyAttack,
        enemyPiercePercent = 0;

    if (game.global.world >= 60) {
        enemyPiercePercent = getPierceAmt();
    }

    if (game.global.spireActive) {
        targetAttack = RedAcesUI.calcDummyEnemyStat('Spire', 'health') / opt.targetSpireNumHits;
        enemyText    = opt.targetSpireNumHits + '-Hit c' + opt.targetSpireCell + ' Spire ' + opt.targetEnemy;
        enemyAttack  = RedAcesUI.calcDummyEnemyStat('Spire', 'attack');
        healthBuffer = 1; // reduced health buffer because of the intense scaling of each imp

        if (!game.global.useShriek) {
            // use magneto shriek!
            magnetoShriek();
        }
    } else if ((game.global.world == opt.voidMapZone)
        && (game.global.lastClearedCell >= opt.voidMapCell)
        && (game.global.totalVoidMaps > 0)
    ) {
        targetAttack       = RedAcesUI.calcDummyEnemyStat('Void', 'health') / opt.targetVoidMapNumHits;
        enemyText          = opt.targetSpireNumHits + '-Hit c99 Void ' + opt.targetEnemy;
        enemyAttack        = RedAcesUI.calcDummyEnemyStat('Void', 'attack');
        enemyPiercePercent = 0;

        if (!game.global.mapsActive || getCurrentMapObject().location !== 'Void') {
            // Apply these masteries (They are already applied if we're in a VM)
            if (game.talents.voidPower.purchased) {
                currentAttack *= 1.15; // 15 % attack
                currentHealth *= 1.15; // 15 % health
            }
            if (game.talents.voidPower2.purchased) {
                currentAttack *= 1.2; // 20 % attack
                currentHealth *= 1.2; // 20 % health
            }
        }
    } else if (game.global.world < opt.voidMapZone - 10) {
        targetAttack  = RedAcesUI.getNeededOverkillAttack('None');
        currentAttack = RedAcesUI.getTrimpsMinAttack(targetFormationBase);
        enemyText     = 'OK c99 ' + opt.targetEnemy + 's';
        enemyAttack   = RedAcesUI.calcDummyEnemyStat('None', 'attack');
    } else {
        var targetNumHits = 1;
        if (game.global.world >= opt.voidMapZone + 5) {
            targetNumHits = 2;
        }
        targetAttack = RedAcesUI.calcDummyEnemyStat('World', 'health') / targetNumHits;
        enemyText    = targetNumHits + '-Hit c99 ' + opt.targetEnemy;
        enemyAttack  = RedAcesUI.calcDummyEnemyStat('World', 'attack');
    }

    var blockedDamage    = Math.min(enemyAttack, game.global.soldierCurrentBlock),
        damageAfterBlock = Math.max(0, enemyAttack - game.global.soldierCurrentBlock) + blockedDamage * enemyPiercePercent,
        targetHealth     = damageAfterBlock * healthBuffer;

    infoEnemySpan.innerHTML  = enemyText;
    infoAttackSpan.innerHTML = 'A: ' + prettify(currentAttack) + ' / ' + prettify(targetAttack);
    infoHealthSpan.innerHTML = 'H: ' + prettify(currentHealth) + ' / ' + prettify(targetHealth);
    if (currentAttack >= targetAttack) {
        infoAttackSpan.style.color = 'lightgreen';
    } else {
        infoAttackSpan.style.color = 'yellow';
    }
    if (currentHealth >= targetHealth) {
        infoHealthSpan.style.color = 'lightgreen';
    } else {
        infoHealthSpan.style.color = 'yellow';
    }

    if ((targetAttack > currentAttack) || (targetHealth > currentHealth)) {
        // Farm it!

        if (!game.global.mapsActive) {
            // Not in a map
            if (!game.global.switchToMaps) {
                // Not "waiting for trimps to die" yet
                message(
                    'RA:autoPlay(): run z' + game.global.world + ' maps',
                    'Notices'
                );
            }
            RedAcesUI.farmMap(0); // Repeat forever
        } else if ((targetHealth > currentHealth)
            && (game.resources.trimps.owned == game.resources.trimps.realMax())
            && game.global.repeatMap
            && !game.global.preMapsActive
        ) {
            // We're in a map, we need more health and our trimps are full
            // Kill them so that the values for HP and Block can be refreshed!
            // Nurseries, Trainers and Gyms dont count to the already fighting group of trimps
            message(
                'RA:autoPlay(): killing the Trimps to get the new HP / Block values',
                'Notices'
            );

            // Go to maps
            while (game.options.menu.exitTo.enabled != 0) { // 0 ... "Exit to Maps"
                toggleSetting('exitTo')
            }

            // Click it twice to really go to the pre-maps-screen
            mapsClicked(true);
            mapsClicked(true);
            runMap();

            while (game.options.menu.exitTo.enabled != 1) { // 1 ... "Exit to World"
                toggleSetting('exitTo')
            }
        }
        return;
    }

    // We've farmed enough!

    if ((game.global.totalVoidMaps > 0)
        && (game.global.world == opt.voidMapZone)
        && (game.global.lastClearedCell >= opt.voidMapCell)
    ) {
        // We're ready for the voids!

        if (game.global.mapsActive) {
            var mapObj = getCurrentMapObject();
            if (mapObj.location !== 'Void' && game.global.repeatMap) {
                // normal map is active, stop repeating
                repeatClicked();
                return;
            }
        } else {
            // no map is active
            message('RA:autoPlay(): running z' + game.global.world + ' void maps', 'Notices');
            RedAcesUI.runVoidMaps();
        }
        return;
    }

    if (!game.global.mapsActive && game.global.preMapsActive) {
        // In pre-Maps screen, waiting for ... something?
        mapsClicked();
        return;
    }

    if (game.global.mapsActive && game.global.repeatMap) {
        // "Repeat on" and we're in a map
        message(
            'RA:autoPlay(): stop z' + game.global.world + ' maps',
            'Notices'
        );
        repeatClicked();
        return;
    }
};

RedAcesUI.calcWarpstationStrategy = function() {
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
            * RedAcesUI.getArtisanistryMult()
            * RedAcesUI.getResourcefulMult(),

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

    if ((RedAcesUI.options.autoBuild.warpstationDelta == warpstationDelta)
        && (RedAcesUI.options.autoBuild.warpstationZero < warpstationZero)
    ) {
        RedAcesUI.options.autoBuild.warpstationZero = warpstationZero;

        message(
            'Updating warpstationZero, new Warpstation Strategy is '
            + RedAcesUI.options.autoBuild.warpstationZero + '+' + RedAcesUI.options.autoBuild.warpstationDelta,
            'Notices'
        );
    } else if ((RedAcesUI.options.autoBuild.warpstationDelta < warpstationDelta)
        && (RedAcesUI.options.autoBuild.warpstationZero != warpstationZero)
    ) {
        RedAcesUI.options.autoBuild.warpstationDelta = warpstationDelta;
        RedAcesUI.options.autoBuild.warpstationZero  = warpstationZero;

        message(
            'Updating warpstation strategy, new Warpstation Strategy is '
            + RedAcesUI.options.autoBuild.warpstationZero + '+' + RedAcesUI.options.autoBuild.warpstationDelta,
            'Notices'
        );
    }
    return warpstationZero + '+' + warpstationDelta;
};

RedAcesUI.calcWarpstationStrategyCurrent = function() {
    if (!game.buildings.hasOwnProperty('Warpstation')
        || !game.upgrades.hasOwnProperty('Gigastation')
    ) {
        message(
            'Warp- or Gigastation not available',
            'Notices'
        );
        return;
    }
    var gigastationAllowed     = game.upgrades.Gigastation.allowed,
        targetWarpstationCount = game.buildings.Warpstation.purchased,
        rawWarpstationDelta    = targetWarpstationCount / gigastationAllowed,
        warpstationDelta       = Math.floor(rawWarpstationDelta / 0.5) * 0.5,
        warpstationZero        = Math.ceil(targetWarpstationCount - warpstationDelta * gigastationAllowed);

    message(
        'You have a level ' + prettify(targetWarpstationCount) + ' warpstation (at ' + gigastationAllowed
        + ' gigastations) so use 0+' + prettify(rawWarpstationDelta) + ' or ' + warpstationZero + '+'
        + warpstationDelta + ' strategy',
        'Notices'
    );

    if ((RedAcesUI.options.autoBuild.warpstationDelta == warpstationDelta)
        && (RedAcesUI.options.autoBuild.warpstationZero < warpstationZero)
    ) {
        RedAcesUI.options.autoBuild.warpstationZero = warpstationZero;

        message(
            'Updating warpstationZero, new Warpstation Strategy is '
            + RedAcesUI.options.autoBuild.warpstationZero + '+' + RedAcesUI.options.autoBuild.warpstationDelta,
            'Notices'
        );
    } else if ((RedAcesUI.options.autoBuild.warpstationDelta < warpstationDelta)
        && (RedAcesUI.options.autoBuild.warpstationZero != warpstationZero)
    ) {
        RedAcesUI.options.autoBuild.warpstationDelta = warpstationDelta;
        RedAcesUI.options.autoBuild.warpstationZero  = warpstationZero;

        message(
            'Updating warpstation strategy, new Warpstation Strategy is '
            + RedAcesUI.options.autoBuild.warpstationZero + '+' + RedAcesUI.options.autoBuild.warpstationDelta,
            'Notices'
        );
    }
    return warpstationZero + '+' + warpstationDelta;
};

/** Sets the document title */
RedAcesUI.autoTitle = function() {
    document.title = 'Trimps z' + game.global.world + '-' + (game.global.lastClearedCell + 2);
    if (getAvailableGoldenUpgrades() > 0) {
        document.title = 'GOLDEN ' + document.title;
    }

    if (game.global.mapsActive) {
        var mapObj = getCurrentMapObject();
        if (mapObj.location === 'Void') {
            document.title += ' (' + game.global.totalVoidMaps + ' VM)';
        } else {
            document.title += ' (M)';
        }
    }
};

/** init main loop */

RedAcesUI.inProgress = false;

RedAcesUI.mainLoop = function() {
    if (RedAcesUI.inProgress) {
        return;
    }
    RedAcesUI.inProgress = true;

    RedAcesUI.autoTitle();
    RedAcesUI.autoHireTrimps();
    RedAcesUI.autoBuild();
    RedAcesUI.autoGather();
    RedAcesUI.displayEfficiency();
    RedAcesUI.autoPause();
    RedAcesUI.autoPlay();

    RedAcesUI.inProgress = false;
};

RedAcesUI.mainTimer = setInterval(
    RedAcesUI.mainLoop,
    1000
);

/** options */

RedAcesUI.toggleAutomation = function (what) {
    RedAcesUI.options[what].enabled = !RedAcesUI.options[what].enabled;
    var button = document.getElementById('RedAcesUIOpt' + what);
    if (RedAcesUI.options[what].enabled) {
        button.className = button.className.replace('colorSuccess', 'colorDanger');
        button.className = button.className.replace('btn-danger', 'btn-success');
    } else {
        button.className = button.className.replace('colorSuccess', 'colorDanger');
        button.className = button.className.replace('btn-success', 'btn-danger');
    }

    if (what === 'autoPlay') {
        var autoPlayInfoDiv = document.getElementById('RedAcesUIAutoPlayInfo');
        if (autoPlayInfoDiv) {
            if (RedAcesUI.options[what].enabled) {
                autoPlayInfoDiv.style.display = 'block';
            } else {
                autoPlayInfoDiv.style.display = 'none';
            }
        }
    }
};

/** Show options buttons */
RedAcesUI.displayOptions = function() {
    var displayButton = function (what, label, where, fullSize, onclickCallback) {
        var button          = document.createElement('div');
        button.innerHTML    = label;

        if (RedAcesUI.options.hasOwnProperty(what)) {
            if (RedAcesUI.options[what].enabled) {
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
                RedAcesUI.toggleAutomation(what);
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
        displayButton('autoBuild', 'AutoBuild', buildingsTitleDiv.childNodes[1].childNodes[3], true);

        displayButton(
            'calcWSStrat',
            'WarpstationStrat',
            buildingsTitleDiv.childNodes[1].childNodes[5],
            true,
            RedAcesUI.calcWarpstationStrategyCurrent
        );
    }

    // Auto Play
    var battleBtnsColumn = document.getElementById('battleBtnsColumn');
    if (battleBtnsColumn) {
        // Toggle auto play
        var toggleBtn        = document.createElement('span'),
            toggleBtnWrapper = document.createElement('div');

        if (RedAcesUI.options.autoPlay.enabled) {
            toggleBtn.className = 'btn btn-success fightBtn';
        } else {
            toggleBtn.className = 'btn btn-danger fightBtn';
        }

        toggleBtn.id        = 'RedAcesUIOpt' + 'autoPlay';
        toggleBtn.innerHTML = 'AutoPlay';
        toggleBtn.onclick   = function () {
            RedAcesUI.toggleAutomation('autoPlay');
        };

        toggleBtnWrapper.className = 'battleSideBtnContainer';

        toggleBtnWrapper.appendChild(toggleBtn);
        battleBtnsColumn.appendChild(toggleBtnWrapper);

        // Display info
        var infoDiv             = document.createElement('div');
        infoDiv.className       = 'battleSideBtnContainer';
        infoDiv.id              = 'RedAcesUIAutoPlayInfo';
        infoDiv.innerHTML       = '<strong>AutoPlay Info</strong>'
            + '<br/><span id="RedAcesUIAutoPlayInfoEnemy" style="font-size: 13px"></span>'
            + '<br/><span id="RedAcesUIAutoPlayInfoAttack" style="font-size: 13px"></span>'
            + '<br/><span id="RedAcesUIAutoPlayInfoHealth" style="font-size: 13px"></span>';
        infoDiv.style.padding      = '2px 5px';
        infoDiv.style.border       = '1px solid black';
        infoDiv.style.borderRadius = '2px';
        infoDiv.style.textAlign    = 'center';

        if (!RedAcesUI.options.autoPlay.enabled) {
            infoDiv.style.display = 'none';
        }

        battleBtnsColumn.appendChild(infoDiv);
    }
};

RedAcesUI.displayOptions();

// ==UserScript==//
// @name           RedAces Trimps-UI
// @namespace      https://github.com/RedAces/Trimps-UI
// @description    Adds some UI elements to Trimps
// @grant          none
// @include        http://trimps.github.io
// @include        https://trimps.github.io
// @include        http://trimps.github.io/*
// @include        https://trimps.github.io/*
// ==/UserScript==

window.RedAcesUI         = window.RedAcesUI || {};
window.RedAcesUI.options = {
    "autoBuild": {
        "enabled":           1,
        "warpstationZero":  20,
        "warpstationDelta":  4,
        "buildings":         {
            "Gym":       -1,
            "Tribute":   -1,
            "Nursery":   -1,
            "Collector": 41,
            "Gateway":   25,
            "Resort":    50,
            "Hotel":     75,
            "Mansion":  100,
            "House":    100,
            "Hut":      100
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
        "enabled":            1,
        "minLevel":           2,
        "maxLevel":           5,
        "maxRelEfficiency": 1.5
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

            if (window.RedAcesUI.options.autoBuyEquipment.enabled) {
                if (game.equipment.hasOwnProperty(itemName)) {
                    equipData = game.equipment[itemName];
                    if (equipData.level < window.RedAcesUI.options.autoBuyEquipment.minLevel) {
                        window.RedAcesUI.buyEquipment(itemName, 1);
                    } else if (items[stat][i].costPerValue / bestStatEfficiency < window.RedAcesUI.options.autoBuyEquipment.maxRelEfficiency) {
                        if (equipData.level < window.RedAcesUI.options.autoBuyEquipment.maxLevel) {
                            window.RedAcesUI.buyEquipment(itemName, 1);
                        } else if (itemPrestiges.hasOwnProperty(itemName)
                            && (itemPrestiges[itemName].allowed === itemPrestiges[itemName].done)
                        ) {
                            // there is no prestige available
                            window.RedAcesUI.buyEquipment(itemName, 1);
                        }
                    }
                }
            }
        }
    }

    // Special case: Shield
    if (game.equipment.hasOwnProperty('Shield')
        && (game.equipment.Shield.locked == 0)
        && (game.equipment.Shield.level < window.RedAcesUI.options.autoBuyEquipment.maxLevel)
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
                "Scientist":    1
            },
            jobRatioSum = 161;
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
    setGather('buildings');
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
    if (game.global.turkimpTimer > 0) {
        setGather('metal');
    } else {
        setGather('science');
    }
};

/** init main loop */

window.RedAcesUI.mainLoop = function() {
    window.RedAcesUI.autoHireTrimps();
    window.RedAcesUI.autoBuild();
    window.RedAcesUI.autoGather();
    window.RedAcesUI.displayEfficiency();
};

if (window.RedAcesUI.mainTimer) {
    clearInterval(window.RedAcesUI.mainTimer);
}

window.RedAcesUI.mainTimer = setInterval(
    window.RedAcesUI.mainLoop,
    1000
);

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

window.RedAcesUI = window.RedAcesUI || {};

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

/** Equipment efficiency */

window.RedAcesUI.displayEquipEfficiency = function () {
    var costMult = Math.pow(1 - game.portal.Artisanistry.modifier, game.portal.Artisanistry.level),
        items    = {"Health": [], "Attack": []},
        itemName,
        stat;

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
        if ((upgradeData.locked == 1)
            || !upgradeData.hasOwnProperty('prestiges')
            || !game.equipment.hasOwnProperty(upgradeData.prestiges)
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

        for (var i in items[stat]) {
            if (!items[stat].hasOwnProperty(i)) {
                continue;
            }

            itemName = items[stat][i].item;

            var efficiencySpan = document.getElementById('RedAcesUIEff' + itemName);

            if (efficiencySpan == undefined) {
                efficiencySpan               = document.createElement('span');
                efficiencySpan.id            = 'RedAcesUIEff' + itemName;
                var itemElement = document.getElementById(itemName);
                if (itemElement == undefined) {
                    continue;
                }
                itemElement.appendChild(efficiencySpan);
            }

            var cssColor = '';
            if (i == 0) {
                cssColor = 'background-color:green;';
            } else if (i == 1) {
                cssColor = 'background-color:yellow;color:black;';
            }

            var costPerValue = items[stat][i].costPerValue,
                exponent     = 0;

            while (costPerValue > 1000) {
                costPerValue = costPerValue / 1000;
                exponent     = exponent + 3;
            }

            efficiencySpan.innerHTML     = '<br/><span style="padding:2px 5px;' + cssColor + '">'
                + stat  + ' #' + (1 * i + 1) + ' (' + costPerValue.toFixed(1) + 'e' + exponent + ')</span>';
        }
    }
};

/** Hires x trimps for a job */
window.RedAcesUI.hire = function(jobName, amount) {
    var currentBuyAmount = game.global.buyAmt,
        firingMode       = game.global.firing;

    if (amount === "Max") {
        // do nothing
    } else if (amount < 0) {
        game.global.firing = true;
        amount             = Math.abs(amount);
    } else {
        game.global.firing = false;
        amount             = Math.min(amount, calculateMaxAfford(game.jobs[jobName], false, false, true));
    }

    if ((amount === 0) || (game.jobs[jobName].locked)) {
        return;
    }

    game.global.buyAmt = amount;
    buyJob(jobName, false, true);
    game.global.buyAmt = currentBuyAmount;
    game.global.firing = firingMode;
};

/** Auto employment of trimps */
window.RedAcesUI.autoEmployTrimps = function() {
    if (game.global.world <= 5) {
        return;
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

    var maxWorkerTrimps = Math.ceil(game.resources.trimps.realMax() / 2)
        - game.jobs['Trainer'].owned
        - game.jobs['Explorer'].owned
        - game.jobs['Geneticist'].owned;

    var trainerButton = document.getElementById('Trainer');
    if (trainerButton !== undefined) {
        window.RedAcesUI.hire('Trainer', 'Max');
    }
    var explorerButton = document.getElementById('Explorer');
    if (explorerButton !== undefined) {
        window.RedAcesUI.hire('Explorer', 'Max');
    }

    for (var jobName in jobRatios) {
        if (!jobRatios.hasOwnProperty(jobName)) {
            continue;
        }

        var jobRatio           = jobRatios[jobName],
            jobEmployees       = game.jobs[jobName].owned,
            targetJobEmployees = Math.floor(maxWorkerTrimps * jobRatio / jobRatioSum),
            nowHiring          = Math.floor(targetJobEmployees - jobEmployees);

        window.RedAcesUI.hire(jobName, nowHiring);
    }
};

/** Build x buildings */
window.RedAcesUI.build = function(buildingName, amount) {
    if (game.buildings[buildingName].locked) {
        return;
    }
    if (amount !== "Max") {
        amount = Math.min(amount, calculateMaxAfford(game.buildings[buildingName], true, false, false, true));
        if (amount <= 0) {
            return;
        }
    }
    buyBuilding(buildingName, false, true, amount);
    setGather('buildings');
};

/** Auto building Buildings */
window.RedAcesUI.autoBuild = function() {
    var buildings = {
        "Gym":       -1,
        "Tribute":   -1,
        "Collector": 41,
        "Gateway":   25,
        "Resort":    50,
        "Hotel":     75,
        "Mansion":  100,
        "House":    100,
        "Hut":      100
    };

    for (var buildingName in buildings) {
        if (!buildings.hasOwnProperty(buildingName)) {
            continue;
        }

        var buildingMax    = buildings[buildingName],
            currentAmount  = game.buildings[buildingName].purchased;

        if (buildingMax === -1) {
            window.RedAcesUI.build(buildingName, "Max");
        } else if (buildingMax > currentAmount) {
            window.RedAcesUI.build(buildingName, buildingMax - currentAmount);
        }
    }

    if (game.upgrades.Gigastation
        && game.buildings.Warpstation
        && (game.buildings.Warpstation.locked == 0)
    ) {
        var warpstationZero    = 20,
            warpstationDelta   = 4,
            currentGigastation = game.upgrades.Gigastation.done,
            currentWarpstation = game.buildings.Warpstation.purchased,
            warpstationLimit   = warpstationZero + warpstationDelta * currentGigastation;

        if (currentWarpstation < warpstationLimit) {
            window.RedAcesUI.build('Warpstation', warpstationLimit - currentWarpstation);
        } else if (game.upgrades.Gigastation.locked == 0) {
            buyUpgrade('Gigastation', true, true);
        }
    }
};

/** Auto player employment */
window.RedAcesUI.autoPlayerJob = function() {
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
        "Megascience"
    ];
    for (var i in importantUpgrades) {
        if (!importantUpgrades.hasOwnProperty(i)) {
            continue;
        }

        var upgradeName = importantUpgrades[i],
            upgrade     = game.upgrades[upgradeName];

        if ((upgrade === undefined) || upgrade.locked || (upgrade.done >= upgrade.allowed)) {
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
    window.RedAcesUI.autoEmployTrimps();
    window.RedAcesUI.autoBuild();
    window.RedAcesUI.autoPlayerJob();

    window.RedAcesUI.displayEquipEfficiency();
};

if (window.RedAcesUI.mainTimer) {
    clearInterval(window.RedAcesUI.mainTimer);
}

window.RedAcesUI.mainTimer = setInterval(
    window.RedAcesUI.mainLoop,
    1000
);

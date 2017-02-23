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
    var costMult = Math.pow(1 - window.game.portal.Artisanistry.modifier, window.game.portal.Artisanistry.level),
        items    = {"Health": [], "Attack": []},
        itemName,
        stat;

    // fill the array with the equipment information
    for (itemName in window.game.equipment) {
        if (!window.game.equipment.hasOwnProperty(itemName)) {
            continue;
        }
        var data = window.game.equipment[itemName],
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
    for (var upgradeName in window.game.upgrades) {
        if (!window.game.upgrades.hasOwnProperty(upgradeName)) {
            continue;
        }

        var upgradeData = window.game.upgrades[upgradeName];
        if ((upgradeData.locked == 1)
            || !upgradeData.hasOwnProperty('prestiges')
            || !window.game.equipment.hasOwnProperty(upgradeData.prestiges)
            || !upgradeData.hasOwnProperty('cost')
            || !upgradeData.cost.hasOwnProperty('resources')
            || !upgradeData.cost.resources.hasOwnProperty('metal')
        ) {
            continue;
        }
        var equipData = window.game.equipment[upgradeData.prestiges],
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
    var currentBuyAmount = window.game.global.buyAmt,
        firingMode       = window.game.global.firing;

    if (amount < 0) {
        window.game.global.firing = true;
        amount                    = Math.abs(amount);
    } else {
        window.game.global.firing = false;
    }

    window.game.global.buyAmt = amount;
    buyJob(jobName, false, true);
    window.game.global.buyAmt = currentBuyAmount;
    window.game.global.firing = firingMode;
};

/** Auto employment of trimps */
window.RedAcesUI.autoEmployTrimps = function() {
    if (window.game.global.world <= 5) {
        return;
    } else if (window.game.global.world <= 150) {
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

    var maxWorkerTrimps = Math.ceil(window.game.resources.trimps.realMax() / 2)
        - window.game.jobs['Trainer'].owned
        - window.game.jobs['Explorer'].owned
        - window.game.jobs['Geneticist'].owned;

    var trainerButton = document.getElementById('Trainer');
    if ((trainerButton !== undefined) && trainerButton.classList.contains('thingColorCanAfford')) {
        window.RedAcesUI.hire('Trainer', 'Max');
    }
    var explorerButton = document.getElementById('Explorer');
    if ((explorerButton !== undefined) && explorerButton.classList.contains('thingColorCanAfford')) {
        window.RedAcesUI.hire('Explorer', 'Max');
    }

    for (var jobName in jobRatios) {
        if (!jobRatios.hasOwnProperty(jobName)) {
            continue;
        }

        var jobRatio           = jobRatios[jobName],
            jobEmployees       = window.game.jobs[jobName].owned,
            targetJobEmployees = Math.floor(maxWorkerTrimps * jobRatio / jobRatioSum),
            nowHiring          = Math.floor(targetJobEmployees - jobEmployees);

        window.RedAcesUI.hire(jobName, nowHiring);
    }
};

/** Build x buildings */
window.RedAcesUI.build = function(buildingName, amount) {
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
            currentAmount  = window.game.buildings[buildingName].purchased,
            buildingButton = document.getElementById(buildingName);

        if ((buildingButton !== undefined)
            && buildingButton.classList.contains('thingColorCanAfford')
            && ((buildingMax === -1) || (buildingMax > currentAmount))
        ) {
            window.RedAcesUI.build(buildingName, 1);
        }
    }
};

/** Auto player employment */
window.RedAcesUI.autoPlayerJob = function() {
    if (window.game.global.buildingsQueue.length > 0) {
        setGather('buildings');
    } else {
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
                upgrade     = window.game.upgrades[upgradeName];

            if ((upgrade === undefined) || upgrade.locked || (upgrade.done >= upgrade.allowed)) {
                continue;
            }

            setGather('science');
            return;
        }
        if (window.game.global.turkimpTimer > 0) {
            setGather('metal');
        } else {
            setGather('science');
        }
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

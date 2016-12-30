// ==UserScript==//
// @name           RedAces Trimps-UI
// @namespace      https://github.com/RedAces/Trimps-UI
// @description    Adds some UI elements to Trimps
// @include        http://trimps.github.io
// @include        https://trimps.github.io
// @include        http://trimps.github.io/*
// @include        https://trimps.github.io/*
// ==/UserScript==

window.RedAcesUI = window.RedAcesUI || {};

/** Upgrade efficiency */

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
                    console.log('Couldnt find equipment ' + itemName);
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

            efficiencySpan.innerHTML     = '<br/><span style="padding:2px 5px;' + cssColor + '">'
                + stat  + ' #' + (1 * i + 1) + ' (' + Math.round(items[stat][i].costPerValue) + ')</span>';
        }
    }
};

window.RedAcesUI.equipEfficiencyTimer = setInterval(
    window.RedAcesUI.displayEquipEfficiency,
    1000
);

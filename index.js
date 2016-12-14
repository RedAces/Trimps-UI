// ==UserScript==//
// @name           RedAces Trimps-UI
// @namespace      RedAcesUI
// @description    Adds some UI elements to Trimps
// @include        http://trimps.github.io
// @include        http://trimps.github.io/*
// ==/UserScript==

window.RedAcesUI = window.RedAcesUI || {};

window.RedAcesUI.displayEquipEfficiency = function () {
    var costMult = Math.pow(1 - window.game.portal.Artisanistry.modifier, window.game.portal.Artisanistry.level),
        items    = {"Health": [], "Attack": []},
        itemName;

    for (itemName in window.game.equipment) {
        if (!window.game.equipment.hasOwnProperty(itemName)) {
            continue;
        }
        var data = window.game.equipment[itemName],
            value,
            stat;

        if (data.locked == 1) {
            continue;
        }

        if (data.hasOwnProperty('attackCalculated')) {
            value = data.attackCalculated;
            stat  = 'Attack';
        } else if (data.hasOwnProperty('blockCalculated')) {
            continue;
        } else if (data.hasOwnProperty('healthCalculated')) {
            value = data.healthCalculated;
            stat  = 'Health';
        } else {
            continue;
        }

        if (Object.keys(data.cost).length > 1) {
            continue;
        }

        var resource     = Object.keys(data.cost)[0],
            cost         = data.cost[resource][0] * Math.pow(data.cost[resource][1], data.level) * costMult,
            costPerValue = cost / value;

        if ((resource != 'metal') || (value == 0)) {
            continue;
        }

        items[stat].push({"item": itemName, "costPerValue": costPerValue});
    }

    for (var stat in items) {
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
                efficiencySpan.style.cssText = 'width:100%;height:20px;';
                efficiencySpan.id            = 'RedAcesUIEff' + itemName;
                var itemElement = document.getElementById(itemName);
                if (itemElement == undefined) {
                    console.log('Couldnt find equipment ' + itemName);
                    continue;
                }
                itemElement.appendChild(efficiencySpan);
            }

            efficiencySpan.innerHTML = '<br/>' + stat  + ' #' + (1 * i + 1) + ' (' + Math.round(items[stat][i].costPerValue) + ')';
        }
    }
};

window.RedAcesUI.equipEfficiencyTimer = setInterval(
    window.RedAcesUI.displayEquipEfficiency,
    1000
);

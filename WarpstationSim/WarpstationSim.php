<?php

/**
 * Class WarpstationSim
 *
 * A Simulator for warpstation and gigastation housings and costs
 */
class WarpstationSim
{
    /**
     * Calculates the amount of housing ONE warpstation provides
     * First Warpstation = 100% => 10.000
     *
     * @param int $gigastationLevel
     *
     * @return int
     */
    public static function calcHousingPerWarpstation($gigastationLevel)
    {
        return pow(1.2, $gigastationLevel);
    }

    /**
     * Returns the "cost" for ONE warpstation
     * First Warpstation = 100%
     * Which would translate to 100e9 Gems or 1e15 Metal
     *
     * @param int $gigastationLevel
     * @param int $existingWarpstations
     *
     * @return int
     */
    public static function calcCostPerWarpstation($gigastationLevel, $existingWarpstations)
    {
        return pow(1.75, $gigastationLevel) * pow(1.4, $existingWarpstations);
    }

    /**
     * Calculates the amount of housing and cost for a certain strategy and gigastation count
     * e. g. strategy 4+2 would mean buy 4 + 2 * G warpstations between each gigastation upgrade (G = current gigastation upgrade)
     * so 4 before the first gigastation
     * 6 after the first gigastation
     * 8 after the second gigastation
     * etc...
     *
     * @param int $warpstationBaseCount
     * @param int $warpstationExtraCountPerGigastation
     * @param int $gigastationCount
     * @param int|null $costLimit
     * @param int|null $housingLimit
     *
     * @return array
     */
    public function calculateGraphData(
        $warpstationBaseCount,
        $warpstationExtraCountPerGigastation,
        $gigastationCount,
        $costLimit = null,
        $housingLimit = null
    )
    {
        $data = [];

        // Do the loop for all gigastations available
        $currentHousing = 0;
        $currentCost    = 0;
        $currentLabel   = '';
        $warpstation    = 1;
        for ($gigastation = 0; $gigastation <= $gigastationCount; $gigastation++) {
            for ($warpstation = 1; $warpstation <= ($warpstationBaseCount + $gigastation * $warpstationExtraCountPerGigastation); $warpstation++) {
                $currentCost       += self::calcCostPerWarpstation($gigastation, $warpstation - 1);
                $currentHousing    += self::calcHousingPerWarpstation($gigastation);
                $data[]             = [
                    'cost'    => $currentCost,
                    'housing' => $currentHousing,
                    'label'   => $currentLabel . '-' . $warpstation,
                ];

                if (($costLimit !== null) && ($currentCost > $costLimit)) {
                    return $data;
                }
                if (($housingLimit !== null) && ($currentHousing > $housingLimit)) {
                    return $data;
                }
            }
            $currentLabel .= '-' . ($warpstation - 1);
        }

        while ((($costLimit !== null) && ($currentCost < $costLimit)) && (($housingLimit !== null) && ($currentHousing < $housingLimit))) {
            $currentCost    += self::calcCostPerWarpstation($gigastation, $warpstation - 1);
            $currentHousing += self::calcHousingPerWarpstation($gigastation);
            $warpstation++;

            $data[]          = [
                'cost'    => $currentCost,
                'housing' => $currentHousing,
                'label'   => $currentLabel . '-' . $warpstation,
            ];
        }

        return $data;
    }
}

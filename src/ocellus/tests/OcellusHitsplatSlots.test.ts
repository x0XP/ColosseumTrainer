import {availableHealSlots} from "../OcellusHitsplatSlots";
test("healsplats preserve the preferred native positions without colliding with damage",()=>{
 expect(availableHealSlots([])).toEqual([[0,30],[-18,20],[18,20],[0,10]]);
 expect(availableHealSlots([[0,10],[0,30]])).toEqual([[-18,20],[18,20]]);
 expect(availableHealSlots([[0,10],[0,30],[-18,20],[18,20]])).toEqual([]);
});

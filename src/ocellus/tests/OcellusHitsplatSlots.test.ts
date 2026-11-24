import {availableHealSlots,reserveHealSlots} from "../OcellusHitsplatSlots";
test("healsplats preserve the preferred native positions without colliding with damage",()=>{
 expect(availableHealSlots([])).toEqual([[0,30],[-18,20],[18,20],[0,10]]);
 expect(availableHealSlots([[0,10],[0,30]])).toEqual([[-18,20],[18,20]]);
 expect(availableHealSlots([[0,10],[0,30],[-18,20],[18,20]])).toEqual([]);
});

test("surviving heals retain slots through expiry and collision",()=>{
 expect(reserveHealSlots([[18,20],undefined],[])).toEqual([[18,20],[0,30]]);
 expect(reserveHealSlots([[0,30],[-18,20]],[[0,30]])).toEqual([[18,20],[-18,20]]);
 expect(reserveHealSlots([[0,30],[0,30],undefined],[])).toEqual([[0,30],[-18,20],[18,20]]);
 expect(reserveHealSlots([undefined,undefined],[[0,10],[0,30],[-18,20],[18,20]])).toEqual([undefined,undefined]);
});

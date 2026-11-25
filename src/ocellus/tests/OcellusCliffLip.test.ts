import {cliffLipDistances} from "../OcellusCliffLip";

test("shelf outline excludes the shared diagonal and vertical cliff faces",()=>{
 const y=-.1;
 const square=[-4,y,0,-4,y,1,-3,y,0, -3,y,0,-4,y,1,-3,y,1];
 const d=cliffLipDistances(square);
 expect([d[1],d[4],d[7],d[9],d[12],d[15]]).toEqual(Array(6).fill(10));
 expect([d[0],d[3],d[6]]).toEqual([0,0,1]);
 expect([...cliffLipDistances([-4,y,0,-4,-2,1,-4,y,1])]).toEqual(Array(9).fill(10));
});

test("a shelf touching the playable floor leaves that connection unlined",()=>{
 const y=-.05;
 const d=cliffLipDistances([3,y,-.3,3,y,0,4,y,0]);
 expect([d[1],d[4],d[7]]).toEqual([10,10,10]);
});

//Activity match :Basketball
const Sequelize = require('sequelize');                                        
const config = require('./config');
const ubilabs = require('./kdTree.js');
const _ = require('lodash');
const activityNeededPeople = 9

var sequelize = new Sequelize(config.database, config.username, config.password, {
    host: config.host,
    dialect: 'mysql',
    pool: {
        max: 5,
        min: 0,
        idle: 30000
    }
});
//in: 2 list(teams,pois) 
//use: kdTree
//out: 1 list  [{teamID:xxx,lat:xxx,log:xxx,count:x},{},{}...{}] x K places
function getObjListxK(teams,pois,ubilabs){
	var objListxK = {}
	var distance = function(a, b){
          return Math.pow(a.lat - b.lat, 2) +  Math.pow(a.log - b.log, 2);
        }
	//poiLoc list prepare
	var poiLocs = []
	for(let poi of pois){
	   var poiLoc ={
                lat:Number(poi.Latitude),
                log:Number(poi.Longitude),
		address:poi.address,
           }
	   //console.log("{lat:"+poiLoc.lat+",log:"+poiLoc.log+"},") 
	   poiLocs.push(poiLoc);
	}

	//build k,d Tree
	var tree = new ubilabs.kdTree(poiLocs, distance, ["lat", "log"]);
	//query with teams
	var res = []
	for(let team of teams){
		//console.log(team)
		var nearest = tree.nearest({lat:team.commonLatitude,log:team.commonLongitude}, 5);//k=5
		//console.log(nearest);
		for (let near of nearest){
		  var temp = {
			teamID:team.teamID,
			lat:near[0].lat,
			log:near[0].log,
			add:near[0].address,
		
			count:team.count,
		  }
		  console.log(near[0])
		  res.push(temp);
		}
	}
	return res;
}
//in :objListxK list
//out : map of (location ===> teamID1,teamID2...)
function generateVote(objListxK){
 
  var vote = new Map();
  
  //mapping value:teamID to key:"lat:xxx,log:xxx"
  for(let ele of objListxK){
        var key = 'lat:'+ele.lat +',log:'+ele.log+',address:'+ele.add;
        var thisEleInfo = ele.teamID + 'cnt:'+ele.count
        if(vote.has(key)){
            var value = vote.get(key)
            value.list.push(thisEleInfo)
	    value.totalcnt = value.totalcnt + ele.count
            vote.set(key,value)
        }else{
            vote.set(key,{list:[thisEleInfo],totalcnt:ele.count})
        }
  }
  
  return vote
}
//count how many people an Activity location have.
//in : all teams in one location
//out : this location has "count" people
function countPeople(teams){
    console.log("teams"+teams)
    var count = 0
    for(let team of teams){
	count = Number(team.split("cnt:")[1])+count;
    }
    return count;
}
//delete the teams of that location
//in : vote
//out: activityToStore -> the deleted teams and its Location. Ready for storage.
function getMaxPplLocAndDelItsTeams(vote){
  var res=getMaxPplLocAndCount(vote)
  var maxPplLoc = res[0]
  vote = res[1]
  for(let rv of vote){
     console.log("print VOTE:"+JSON.stringify(rv))
  }
  console.log("========================")
  console.log("PPPPPPPPP:"+JSON.stringify(maxPplLoc[1].totalcnt))

 // var list = maxPplLoc.split(",")  //list[]-> lat:xx,log:xx,add:xx,team1:2,team2:2,team3:3...(teams and numbers starts from list[3])
  var objarray = obj2array(maxPplLoc)

  console.log("liuchong"+JSON.stringify(maxPplLoc))  

  if(maxPplLoc[1].totalcnt < activityNeededPeople){ //if the (most players)' team is smaller than ActivityNeededPeople ,then return no matched teams and old vote.

   // var matchedTeams2 = matchRest(objarray,vote)

    var candidates = voteEle2candidates(vote)
    console.log("hhhhh"+candidates)
    var list = judgeWhoToPull(candidates,maxPplLoc, activityNeededPeople)
    //var list = combinationSumII(candidates, activityNeededPeople)
    console.log(list)
    return [[],vote]

  }else{ 
    var matchedTeams = match(objarray,maxPplLoc[0]) 
    
    var unMatchedTeams = deleteTeams(matchedTeams[1],vote)
    return [matchedTeams,unMatchedTeams]
  }
}
//function:pull teams to the largest team. By using the largest team as centroid and calculate the smallest distance sum.
//implementation:use activityNeededPeople minus the largest number of team and find the number of people needed. go through the combinationSumII to get the combination.
//in:candidates,maxPplLoc, activityNeededPeople
//out:list of pulled team(matched teams)
function judgeWhoToPull(candidates,maxPplLoc, activityNeededPeople){
  var list = []
  var centroid_address = maxPplLoc[0]   //address
  var centroid_cnt = maxPplLoc[1].totalcnt //num
  var centroid_list = maxPplLoc[1].list //team id list
  var minus = activityNeededPeople - centroid_cnt
  //var combos = combinationSumII(candidates, 2)
  //console.log("combos"+JSON.stringify(combos))
  return list
}

//function:take the rest of vote and turn them to 
//in: the rest of vote pool
//out: candidates for the combinationSumII algorithm  
function voteEle2candidates(restVote){
   var candidates = []
   for(let ele of restVote){
     console.log("print vote:"+JSON.stringify(ele))
     var can = {
        lag:ele[0].split(",")[0].split(":")[1],
	log:ele[0].split(",")[1].split(":")[1],
	address:ele[0].split(",")[2].split(":")[1],
	teamid:ele[1].list,  //string:
        num:ele[1].totalcnt
     } 
     candidates.push(can)
   }
   console.log("========================")
   
   console.log("print canarray:"+JSON.stringify(candidates))

   return candidates
}


//function:regulate the teams into a particular number. eg:location:19 people, subtract it to 9 for basketball
//in: list of teams that where not matched in numbers.
//out: matchedTeams
function match(objarray,address){
  
  var list = combinationSumII(objarray, activityNeededPeople) //all the possible combinations that adds to 9
  console.log("YYYYYYYYYYYY"+JSON.stringify(list))
  
  return [address,list[0]]   //address,matchedteams
}

//function:combination sumII from leetcode https://leetcode.com/problems/combination-sum-ii/discuss/117207/JavaScript-solution-beating-100
//in:objarray [{teamid:xxxx,num:1},{teamid:xxx,num:3}...]
//out:every combination that sums to target.  [[combination1],[combination2]..]
function combinationSumII(candidates, target){
  console.log(candidates)
  if (!candidates || !candidates.length) { return []; } 
  candidates.sort((a,b) => b.num - a.num); //let the team with max number go first.
  const solutions = [];
    
  const findCombos = function(candIdx, subtotal, solution) {
      for (let i = candIdx; i < candidates.length; i++) {
          if (subtotal + Number(candidates[i].num) === target) { 
              solutions.push(solution.concat(candidates[i])); 
          } else if (subtotal + Number(candidates[i].num) < target && i + 1 < candidates.length) { 
              findCombos(i + 1, subtotal + Number(candidates[i].num), solution.concat(candidates[i])); 
          }
          while ((i+1 < candidates.length)&&(candidates[i + 1].num === candidates[i].num)) { i++; }
      };
  };
  findCombos(0, 0, []);
  return solutions;
}

//function:turn list into a object array  [team1:1,team2:3,team3:2....]
//in: list
//out:object array
function obj2array(maxPplLoc){
  console.log("1111111111111"+ JSON.stringify(maxPplLoc))
  var list = maxPplLoc[1].list
  var objarray = []
  for(let i=0;i<list.length;i++){
    var temp = list[i].split("cnt:")
    var ele = {
 	teamid:temp[0],
	num:temp[1]
    }
    objarray.push(ele)
  }
  console.log("print objarray:"+JSON.stringify(objarray))
  return objarray
}

//function:delete maxPplLoc in the vote pool(map)
//in:matchedTeams and vote pool(map)
//out:vote pool that have been deleted maxPplLoc
function deleteTeams(matchedTeams,vote){
  var teams2Delete = matchedTeams //[team1,team2...] 
  console.log('teams2Delete:'+JSON.stringify(teams2Delete)) //deleting matched Teams in voting map.
  //var residueVote = new Map();
  for(let v of vote){
   // console.log('before:'+v[1])
    for(let dt of teams2Delete){
	//console.log("dt@@@@@@@"+JSON.stringify(dt.teamid+'cnt:'+dt.num))
        if(v[1].list.indexOf(String(dt.teamid+'cnt:'+dt.num))!==-1){
            var i =v[1].list.indexOf(String(dt.teamid+'cnt:'+dt.num))
            v[1].list.splice(i,1);
	    //console.log("dt===="+JSON.stringify(dt))
        }else{
           continue;
        }
    //console.log('deleteTeams:'+deleteTeams)
    }
    //console.log('after:'+v[1])
    //residueVote.set(v[0],v[1]);
  }
/*
  for(let r of residueVote){
    console.log("print vote:"+JSON.stringify(r))
  } 
      console.log("========================")

  for(let v of vote){
    console.log("print vote:"+JSON.stringify(v))
  }

*/
  return vote
}
//function:get the Location with Max people and count each row's number of people
//in:vote map in this round 
//out:the Location with the most amount of people.  maxPplLoc[0]->(lat log add)  maxPplLoc[1]->(team1:1,team2:3,team3:2...)
function getMaxPplLocAndCount(vote){
  var maxPplLoc = {}
  var temp = {}
  for(let v of vote){

    v[1].totalcnt = countPeople(v[1].list)
    
    // deep copy v to maxPplLoc by stringify and parse
    if(JSON.stringify(temp)==='{}'){
	temp =v
    }else if(temp[1].totalcnt < v[1].totalcnt ){
	temp =v
    }else{
       continue;
    }
  }
  maxPplLoc[0] = temp[0]
  maxPplLoc[1] ={
    list : temp[1].list,
    totalcnt : temp[1].totalcnt
  }
  console.log("UUUUUU"+maxPplLoc[0])
  return [maxPplLoc,vote] 
}

// in: 2 list(teams,pois) 
// flow: getObjListxK ->vote by location ->recursively remove teamID
// out: map
function matchActivity(teams,pois){
   
  var objListxK = getObjListxK(teams,pois,ubilabs)
  var vote = generateVote(objListxK)
  console.log("trying!!:"+vote)
  for(let v of vote){
            console.log("v:"+v)
  }  
 
  //var res = getMaxPplLocAndDelItsTeams(vote);
  //var act2Store = res[0]
  //vote = res[1]
/*  var res = looping(vote) 
  var matchedTeams = res[0]
  var residueVote = res[1]
*/
  //match the rest of vote pool
  //var matchedTeams = matchRest(residueVote,matchedTeams1)  

 // console.log('matchedTeams2:'+JSON.stringify(matchedTeams))

}
//function:iterate through the vote pool and grab matchedTeams
//in:vote pool
//out:matchedTeams and residue vote pool
function looping(vote){
   var matchedTeams = [] 
   var res = []
   while(JSON.stringify(res[0])!=='[]'){
     //lastVote = new Map(vote)   //deep copy vote map
     res = getMaxPplLocAndDelItsTeams(vote);
     matchedTeams.push(res[0])
     vote = res[1]
   }
   return [matchedTeams,vote]
}

//function:take the rest of vote and match team stochastically->based on centroid coordinates
//in: the rest of vote pool,matchedTeams(after looping) 
//out: concatenated matchedTeams from the rest of the vote pools and the matchedTeams(after looping) 
/*function matchRest(restVote,matchedTeams1){
   var matchedTeams2 = []
   for(let rv of restVote){
     console.log("print vote:"+JSON.stringify(rv))
      
   } 
   console.log("========================")
   

   return matchedTeams2
} */

//function:FOR MATCHING REST OF VOTE POOL VERSION:combination sumII from leetcode https://leetcode.com/problems/combination-sum-ii/discuss/117207/JavaScript-solution-beating-100
//in:objarray ["lat:39.890363,log:116.333345,address:广外大街马连道胡同(近家乐福)",{"list":["1522572704060cnt:1","team-15225807 activityNeededPeople
//out:every combination that sums to target.  [[combination1],[combination2]..]
/*function combinationSumII(candidates, target){
  console.log(candidates)
  if (!candidates || !candidates.length) { return []; }

  candidates.sort((a,b) => b.num - a.num); //let the team with max number go first.
  const solutions = [];

  const findCombos = function(candIdx, subtotal, solution) {
      for (let i = candIdx; i < candidates.length; i++) {
          if (subtotal + Number(candidates[i].num) === target) {
              solutions.push(solution.concat(candidates[i]));
          } else if (subtotal + Number(candidates[i].num) < target && i + 1 < candidates.length) {
              findCombos(i + 1, subtotal + Number(candidates[i].num), solution.concat(candidates[i]));
          }
          while ((i+1 < candidates.length)&&(candidates[i + 1].num === candidates[i].num)) { i++; }
      };
  };
  findCombos(0, 0, []);
  return solutions;
} */




function storeActivity(act2Store){

   var line = sequelize.define('Teams', {
      activityID: {
        type: Sequelize.STRING(255),
        primaryKey: true
      },
      activityName: Sequelize.STRING(255),
      teamID: Sequelize.STRING(100000),
      activityPlace: Sequelize.STRING(255),
      commonLatitude: Sequelize.DOUBLE,
      commonLongitude: Sequelize.DOUBLE,
   }, {
      timestamps: false
      });
    
    //parse act2Store
    var info = act2Store.split(","); 
    //var lat = (Number)info[0]
    //var log = (Number)info[1]
    //var address = info[2].split("address:")[1]
    



    //parse act2Store 
    var now = Date.now();
    (async () => {
 
	console.log(map[0]+'==='+map[1])
	var spots = []
	for(let person of map[1]){
		var spot ={
			latitude:person.Latitude,
			longitude:person.Longitude
		}
		spots.push(spot);
		//console.log(person)			
	}
	var center = geolib.getCenter(spots);
	console.log(center)

	var inserted= await teams.create({
       		teamID: map[0],
       		activityName: map[1][0].activityName,
         	activityID: '',
          	commonLatitude: center.latitude,
         	commonLongitude: center.longitude,
         	selectDate:map[1][0].selectDate,
         	calculateTime:now,
         	count:spots.length, 
        });
	console.log('created: ' + JSON.stringify(inserted));

    })(); 
}



module.exports ={ matchActivity };



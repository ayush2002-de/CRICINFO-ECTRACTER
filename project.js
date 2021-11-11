let minimist=require("minimist");
let axios=require("axios");
let jsdom=require("jsdom");
let excel=require("excel4node");
let pdf=require("pdf-lib");
let fs=require("fs");
let path=require("path");

let args=minimist(process.argv);
//console.log(args.source);

let responsepromise=axios.get(args.source);
responsepromise.then(function(response)
{
    let html=response.data;

    let dom=new jsdom.JSDOM(html);
    let document=dom.window.document;
   

    let matches=[];
    let matchdivs=document.querySelectorAll("div.match-score-block");
    for(let i=0;i<matchdivs.length;i++)
    {
        let matchdiv=matchdivs[i];
        let match={
            venue:"",
            t1:"",
            t2:"",
            t1s:"",
            t2s:"", 
            result:""
        };
        let venue =matchdiv.querySelector(" div.match-info > div.description");
        match.venue=venue.textContent;
        let teamparas=matchdiv.querySelectorAll("div.name-detail >p.name");
        match.t1=teamparas[0].textContent;
        match.t2=teamparas[1].textContent;

        let scorespans=matchdiv.querySelectorAll("div.score-detail > span.score");
        if(scorespans.length==2)
        {
            match.t1s=scorespans[0].textContent;
            match.t2s=scorespans[1].textContent;
        }else if(scorespans.length==1)
        {
            match.t1s=scorespans[0].textContent;
            match.t2s="";
        }else{
            match.t1s="";
            match.t2s="";
        }

        let resultspan=matchdiv.querySelector("div.status-text> span");
        match .result= resultspan.textContent;
        matches.push(match);
    }
    let matchesjson=JSON.stringify(matches);
     fs.writeFileSync("matches.json",matchesjson,"utf-8"); 
    let teams=[];
    for(let i=0;i<matches.length;i++)
    {
        putteamIfmissing(teams,matches[i]);
    }
    for(let i=0;i<matches.length;i++)
    {
        putteamInappropriateteam(teams,matches[i]);
    }
    
     let teamsjson=JSON.stringify(teams);
     fs.writeFileSync("teams.json",teamsjson,"utf-8"); 
    
     

     createExcel(teams);
     createfolders(teams);

});

function createfolders(teams)
{
    fs.mkdirSync(args.dest);

    for(let i=0;i<teams.length;i++)
    {
        let folderName=path.join(args.dest,teams[i].name);
        fs.mkdirSync(folderName);
        for(let j=0;j<teams[i].matches.length;j++)
        {
            let matchFileName=path.join(folderName,teams[i].matches[j].opponent+j+".pdf");
            createScoreCard(teams[i].name,teams[i].matches[j],matchFileName);
        
        }
    }
}
function createScoreCard(teamName,match,matchFileName)
{
    let venue=match.venue;
    let t1=teamName;
    let t2=match.opponent;
    let t1s=match.selfscore;
    let t2s=match.oppscore;
    let result=match.result;
    let byteOfPdfTemplate=fs.readFileSync("template.pdf");
    let pdfPromise=pdf.PDFDocument.load(byteOfPdfTemplate);
    pdfPromise.then(function(pdfdoc)
    {
         let page= pdfdoc.getPage(0);
        //  page.drawText(venue,{
        //      x:300,
        //      y:709,
        //      size:18
        //  });
         page.drawText(t1,{
            x:260,
            y:496,
            size:18,
           
        });
        page.drawText(t2,{
            x:260,
            y:466,
            size:18,
          
        });
        page.drawText(t1s,{
            x:260,
            y:436,
            size:18,
            
        });
        page.drawText(t2s,{
            x:260,
            y:407,
            size:18,
          
        });
        page.drawText(result,{
            x:260,
            y:386,
            size:11,
          
        });
         let finalPromise=pdfdoc.save();
         finalPromise.then(function(finalPdfBytes)
         {
             fs.writeFileSync(matchFileName,finalPdfBytes);
         });
    }
    );
}


function putteamIfmissing(teams,match)
{
        addnameteam(teams,match.t1);
        addnameteam(teams,match.t2); 
}
function addnameteam(teams,names)
{
    let t= -1;
    for(let i=0;i<teams.length;i++)
    {
        if(teams[i].name==names)
        {
            t=i;
            break;
        }
    }
    if(t==-1)
    {
        teams.push({
              name:names,
              matches:[]
        });
    }
}
function putteamInappropriateteam(teams,match)
{
    let t= -1;
    for(let i=0;i<teams.length;i++)
    {
        if(teams[i].name==match.t1)
        {
            t=i;
            break;
        }
    }
    let team1=teams[t];
    team1.matches.push({
        venue_and_date:match.venue,
        opponent:match.t2,
        selfscore:match.t1s,
        oppscore:match.t2s,
        result:match.result
    })
    let t2= -1;
    for(let i=0;i<teams.length;i++)
    {
        if(teams[i].name==match.t2)
        {
            t2=i;
            break;
        }
    }
    let team2=teams[t2];
    team2.matches.push({
        venue_and_date:match.venue,
        opponent:match.t1,
        selfscore:match.t2s,
        oppscore:match.t1s,
        result:match.result
    })
}
function createExcel(teams)
{
    let wb=new excel.Workbook();
    var style1 = wb.createStyle({
    font: {
      color: '#FF0800',
      size: 14,
    },
    // fill:{
    //     type: "pattern",
    //     patternType: "solid", 
    //     bgColor:  "green",
    //     fgColor: "blue"
    // }

    });
    var style2 = wb.createStyle({
    font: {
      color: '#00FF00',
      size: 12,
    },
    // fill:{
    //     type: "pattern",
    //     patternType: "solid", 
    //     bgColor:  "blue",
    //     fgColor: "orange"
    // }

    });

    for(let i=0;i<teams.length;i++)
    {
        let sheet=wb.addWorksheet(teams[i].name);

        sheet.cell(1,1).string("Opponent").style(style1);
        sheet.cell(1,2).string("self_score").style(style1);
        sheet.cell(1,3).string("opponent_score").style(style1);
        sheet.cell(1,4).string("Result").style(style1);

        for(let j=0;j<teams[i].matches.length;j++)
        {
            sheet.cell(2+j,1).string(teams[i].matches[j].opponent).style(style2);
            sheet.cell(2+j,2).string(teams[i].matches[j].selfscore).style(style2);
            sheet.cell(2+j,3).string(teams[i].matches[j].oppscore).style(style2);
            sheet.cell(2+j,4).string(teams[i].matches[j].result).style(style2);
        }
    }
    wb.write(args.excel);
    //node project.js --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results --dest=worldcup --excel=worldcup.csv
}

var express = require('express');
var router = express.Router();

var qp = require('flexqp-transaction');
qp.presetConnection(require('../dbconfig.json'));
var testdbconfig = require('../dbconfig.json');


var moment = require("moment")
var Twitter = require('twitter');
var solr = require('solr-client');
var natural = require('natural');
var sentiment = require('sentiment');





router.get('/', async function (req, res, next) {

  var passBackData = {};
  passBackData.title = 'Search Tweets';
  passBackData.feedback = false;

  res.render('index', { temp: passBackData });


});

router.post('/', async function (req, res, next) {
  // console.log(req.body.query);

  var client = solr.createClient();
  client.autoCommit = true;
  //req.body.query
  var query2 = client.createQuery()
    .q({ tweet: req.body.query })
    .start(0)
    .rows(20000);

  client.search(query2, function (err, obj) {
    if (err) {
      console.log(err);
    } else {
      var timelapse = obj.responseHeader.QTime ;
      var passBackData = {};
      passBackData.title = 'Search Tweets';
      passBackData.feedback = true;
      passBackData.query = req.body.query;
      passBackData.feedbackMessage = "Number of tweets found : " + obj.response.numFound ;
      passBackData.queryTime =  "Query time(ms) : "+obj.responseHeader.QTime ;
      //if obj.response lenght = 0 then run spell check code
      if (obj.response.numFound == 0) {

        //run spell check get the 1st clue and run the query search
        client.spell(query2, function (err, obj) {
          if (err) {
            console.log(err);
          } else {
            console.log(obj);
            var word = obj.spellcheck.suggestions[1].suggestion[0].word
            timelapse +=  obj.responseHeader.QTime ;
            passBackData.feedbackMessage = "Do you mean " + word + "? Displaying search result of " + word;
            query2 = client.createQuery()
              .q({ tweet: word })
              .start(0)
              .rows(20000);
            client.search(query2, function (err, obj) {
              if (err) {
                console.log(err);
              } else {
                console.log(obj);
                timelapse += obj.responseHeader.QTime ;
                passBackData.queryTime =  "Query time(ms) : "+timelapse;
                passBackData.response = obj.response;
                res.render('index', { temp: passBackData });
              }
            });

          }
        });
      }
      else {

        passBackData.response = obj.response;
        res.render('index', { temp: passBackData });
      }


    }
  });

});


router.get('/summary', async function (req, res, next) {

  res.render('summary', { title: 'Chart' });

});


//CRON JOB will run at every @ 28th of the month 1am 1min

// var schedule = require('node-schedule');
// //Cron Jobs schedule 
// var job = schedule.scheduleJob('1 1 28 * *', async function () {
//   var searchQuery = {};
//   //Pull tweet data
//   var tweets = await queryAPI(null);
//   //Save to SOLR
//   await saveToDb(tweets);
//   //If there more than 100 tweets, code will call for next "page" of tweets
//   do {
//     tweets = await queryAPI(tweets.next);

//     await saveToDb(tweets);

//   } while (tweets.next != null)
// });



const getBearerToken = require('get-twitter-bearer-token');

const twitter_consumer_key = 'xxx'
const twitter_consumer_secret = 'xxx'
var tempBear = {};

getBearerToken(twitter_consumer_key, twitter_consumer_secret, (err, res) => {
  if (err) {
    // handle error 
  } else {

    // bearer token 
    temp = res.body.access_token
    console.log(res.body.access_token)
  }
})

//Used for crawling tweets via twitter API 

var client = new Twitter({
  consumer_key: 'xxx',
  consumer_secret: 'xxx',
  bearer_token: tempBear
});


function queryAPI(nextTEXT) {
  return new Promise((resolve, reject) => {

    // var fromDate = new Date('2017-12-01');
    // var toDate = new Date('2017-12-31');
    // let temptoDate = moment(toDate);
    // let tempfromDate = moment(fromDate);

    if (nextTEXT != null) {

      client.get('tweets/search/30day/IRcrawl30.json', { query: 'lang:en gun control #guncontrol', maxResults: '100', next: nextTEXT }, function (error, tweets, response) {

        if (error) {
          reject(error);
          return
        }
        else {
          resolve(tweets);

        }
      });
    } else {

      client.get('tweets/search/30day/IRcrawl30.json', { query: 'lang:en gun control #guncontrol', maxResults: '100' }, function (error, tweets, response) {

        if (error) {
          reject(error);
          return
        }
        else {
          resolve(tweets);

        }
      });

    }

  })
}


async function saveToDb(tweets) {

  for (let x = 0; x < tweets.results.length; x++) {
    var connection = await qp.connectWithTbegin();
    console.log(x);
    if (x == 53) {
      console.log(x);
    }
    try {

      var data = {};
      // id, text, user_lang, lang, retweet_count, created_at, full_text, hashtags, user_screenname
      data.id = tweets.results[x].id;
      data.text = tweets.results[x].text;
      data.user_lang = tweets.results[x].user.lang;
      data.user_screenname = tweets.results[x].user.screen_name;
      data.lang = tweets.results[x].lang;
      data.retweet_count = tweets.results[x].retweet_count;
      let now = moment(tweets.results[x].created_at);
      data.created_at = now.format("YYYY-MM-DD HH:MM:SS");
      if (tweets.results[x].entities.hashtags.length != 0) {
        var tempString = '';
        for (let u = 0; u < tweets.results[x].entities.hashtags.length; u++) {
          tempString += tweets.results[x].entities.hashtags[u].text;
          tempString += ","
        }
        data.hashtags = tempString;
      }
      var resultbefore = await qp.execute('select *  from test.pct where id = ? ', [data.id], connection);
      if (resultbefore.length == 0) {
        let hahah = data.text;
        let string = hahah.replace(/(^|\s)(#[a-zA-Z.\d-]+)/ig, "");
        string = string.replace(/\s\s+/g, ' ');
        let string2 = string.replace(/(^|\s)(@[a-zA-Z_\d-]+)/ig, "");
        let string3 = string2.replace(/(https?|ftp):\/\/[\.[a-zA-Z0-9\/\-]+/g, "");
        // string3=   string3.replace(/\b(https:\/)/g, "");
        let string5 = string3.replace(/\./g, " ");
        string5 = string5.replace(/(^|\s)(#[a-zA-Z\d-]+)/ig, "");
        //  let string4 = string5.replace(/^[{RT:} ]+/ig, "");
        let string4 = string5.replace(/^RT:/ig, "");
        //  string4 = string4.replace(/^{RT:, }/ig, "");
        let string6 = string4.replace(/(^|\s)(@[A-Za-z\d-]+)/ig, "");

        console.log("After: " + string6);
        // dataResult[x].pro_tweet = string6;
        natural.PorterStemmer.attach();
        dataResult[x].pro_tweet = string6.tokenizeAndStem().join(" ");
        var r1 = sentiment(string6);
        data.m_score = r1.score;
        data.m_comparative = r1.comparative;

        var result = await qp.execute('insert into test.pct set ?', [data], connection);

        // Create a client
        var client = solr.createClient();

        // Switch on "auto commit", by default `client.autoCommit = false`
        client.autoCommit = true;

        client.add([data], function (err, obj) {
          if (err) {
            console.log(err);
          } else {
            console.log(obj);
          }
        });

      }

      qp.commitAndCloseConnection(connection);

    }
    catch (error) {
      qp.rollbackAndCloseConnection(connection);

      console.log(error);

    }
  }

}

router.get('/cleanUpdate', async function (req, res, next) {

  //Do DB update on sentiment

  //var classifier = new natural.LogisticRegressionClassifier();
  // try{
  //   var connection = await qp.connectWithTbegin();
  //   var resultbefore = await qp.execute('select *  from test.pct  ', [], connection);
  //   for(let x = 0 ; x < resultbefore.length ;x++){
  //     let tempResult = resultbefore[x].tweet;
  //     tempResult =   tempResult.replace(/(https?|ftp):\/\/[\.[a-zA-Z0-9\/\-]+/g, "");

  //     var r1 = sentiment(tempResult);
  //     resultbefore[x].m_score = r1.score;
  //     resultbefore[x].m_comparative = r1.comparative;

  //     var updateResult = await qp.execute('update test.pct set ?  where id = ? ', [resultbefore[x],resultbefore[x].id], connection);

  //   }


  //   qp.commitAndCloseConnection(connection);

  // }
  // catch(error){

  //   qp.rollbackAndCloseConnection(connection);

  //   console.log(error);
  // }

  //insider into SOLR
  // var client = solr.createClient();
  // client.autoCommit = true;
  // var docs = await qp.executeAndFetchPromise("select * from test.pct ",[],testdbconfig);



  //   client.add(docs,function(err,obj){
  //     if(err){
  //        console.log(err);
  //     }else{
  //        //console.log(obj);
  //     }
  //   });


  //Portover old db data label and update new dp label data 
  // for(let d = 23 ; d <32; d++){
  // console.log("date :" + d);
  //   for (let u = 0; u <24;u++){
  //     console.log(u);
  //       var docs = await qp.executeAndFetchPromise("select id from me2db.pct where label = -10 and day(created_at) = ?  and HOUR(created_at) <=?  and HOUR(created_at) >=?;",[d,(u+1),u],olddbconfig);
  //       console.log("lenght " +docs.length);
  //       for ( let x = 0 ; x <docs.length ; x ++ ){

  //       await qp.executeUpdatePromise("update test.pct set label = -10 where id = ? ",docs[x].id,testdbconfig)

  //       }

  //     }
  // }




  // var client = solr.createClient();
  // client.autoCommit = true;
   //var docs = await qp.executeAndFetchPromise("select * from test.pct where for_train = 1 ", [], testdbconfig);



  // client.add(docs,function(err,obj){
  //   if(err){
  //      console.log(err);
  //   }else{
  //      //console.log(obj);
  //   }
  // });

  //var classifier = new natural.BayesClassifier();
  // natural.BayesClassifier.load('test.json', null, async function (err, classifier) {
  //   // console.log(classifier.classify('Two-thirds of voters support tougher gun control after Florida shooting massacre, poll says'));
  //   // console.log(classifier.classify('we need gun control'));
  //   for(let x = 0 ; x < docs.length ; x ++ ){
  //     // classifier.addDocument(docs[x].tweet,"Neutral/News");
  //     var classify =  classifier.classify(docs[x].tweet)
  //     if(classify == "Neutral/News"){
  //       docs[x].label = 0.5;
  //     }else if (classify == "pro gun control"){
  //       docs[x].label = 1;
  //     }else {
  //       docs[x].label = 0;
  //     }
   
  //   }   
  //   for(let x = 0 ; x < docs.length ; x++){
      
  //    await qp.executeUpdatePromise("update test.pct set label = ? where id = ? ", [docs[x].label,docs[x].id], testdbconfig);
  //   }
  // });

  // var client = solr.createClient();
  // client.autoCommit = true;
  // var docs = await qp.executeAndFetchPromise("select * from test.everything ",[],testdbconfig);

  //   client.add(docs,function(err,obj){
  //     if(err){
  //        console.log(err);
  //     }else{
  //        console.log(obj);
  //     }
  //   });


  // var docs = await qp.executeAndFetchPromise("select * from test.pct where for_train = 1 ", [], testdbconfig);
  // var classifier = new natural.BayesClassifier();
  // for(let x = 0; x < docs.length ; x ++){

  //     if(docs[x].m_label == 1){

  //       classifier.addDocument(docs[x].tweet, 'pro gun control');
  //     }
  //     else if(docs[x].m_label == 0){

  //       classifier.addDocument(docs[x].tweet, 'non pro gun control');
  //     }
  //     else {

  //       classifier.addDocument(docs[x].tweet, 'Neutral/News');
  //     }

  // }

  // classifier.train();

  // classifier.save('test.json', function(err, classifier) {
  //     // the classifier is saved to the classifier.json file!
  // });


   var docs = await qp.executeAndFetchPromise("select * from (select * from test.pct where for_train is null ) as t where  t.m_label = 1 or t.m_label = 0.5 or t.m_label = 0;", [], testdbconfig);
   classifier = new natural.BayesClassifier();
   natural.BayesClassifier.load('classifier.json', null, async function(err, classifier) {
    // console.log(classifier.classify('long SUNW'));
    // console.log(classifier.classify('short SUNW'));
      var tempResult = {};
      var t_label = {};
      var updateResult = {};
      for(let x = 0; x < docs.length ; x ++){

        tempResult = classifier.classify(docs[x].tweet);
        
        console.log(tempResult);
        if(tempResult == "pro gun control"){
          t_label = 1;

        }else if (tempResult == "non pro gun control"){
          t_label = 0;
        }else {
          t_label = 0.5;
        }
        updateResult =  await qp.executeUpdatePromise("update test.pct set t_label = ? where id = ? ", [t_label,docs[x].id], testdbconfig);

      }

  });


});


// router.get('/test', async function (req, res, next) {

//   var searchQuery = {};

//   var tweets = await queryAPI(null);
//    await saveToDb(tweets);

//   do {
//     tweets = await queryAPI(tweets.next);

//     await saveToDb(tweets);

//   } while (tweets.next != null)

// });


// Used to clean the tweets
// router.get('/', async function (req, res, next) {


//   for (let u = 1; u < 8; u++) {
//     var dataResult = await qp.executeAndFetchPromise('SELECT * FROM test.gc where day(created_at) = ?', [u], testdbconfig);

//     for (let x = 0; x < dataResult.length; x++) {
//       try {
//         var connection = await qp.connectWithTbegin();
//         let hahah = dataResult[x].text;
//         console.log("Before: "+hahah )
//         if (dataResult[x].id == 966134692406636500){
//           console.log("HERE");
//         }
//         let string = hahah.replace(/(^|\s)(#[a-zA-Z.\d-]+)/ig, "");
//         string = string.replace(/\s\s+/g, ' ');
//         let string2 = string.replace(/(^|\s)(@[a-zA-Z_\d-]+)/ig, "");
//         let string3 = string2.replace(/(?:https?|ftp):\/\/[\n\S]+/g, "");
//         string3=   string3.replace(/\b(https:\/)/g, "");
//         let string5 = string3.replace(/\./g," ");
//         string5 =    string5.replace(/(^|\s)(#[a-zA-Z\d-]+)/ig, "");
//       //  let string4 = string5.replace(/^[{RT:} ]+/ig, "");
//        let string4 = string5.replace(/^RT:/ig, "");
//       //  string4 = string4.replace(/^{RT:, }/ig, "");
//         let string6 = string4.replace(/(^|\s)(@[A-Za-z\d-]+)/ig, "");

//         console.log("After: "+string6);
//         dataResult[x].text = string6;

//         var result = await qp.execute('update test.gc set ? where id = ?', [dataResult[x], dataResult[x].id], connection);

//         qp.commitAndCloseConnection(connection);

//       }
//       catch (error) {
//         qp.rollbackAndCloseConnection(connection);

//         console.log(error);

//       }
//     }


//   }


// });

router.get('/classify', async function (req, res, next) {

  var passBackData = {};
  passBackData.title = 'Classify Tweets';
  passBackData.feedback = false;

  res.render('classify', { temp: passBackData });

});

router.post('/classify', async function (req, res, next) {

  var passBackData = {};
  passBackData.title = 'Classify Tweets';
  passBackData.feedback = false;

  classifier = new natural.BayesClassifier();
  natural.BayesClassifier.load('classifier.json', null, function (err, classifier) {
    var result = "Text enter is " + classifier.classify(req.body.query);
    passBackData.feedback = true;
    passBackData.feedbackMessage = result;
    passBackData.query = req.body.query;
    res.render('classify', { temp: passBackData });
  });

});


router.post('/classify-update', async function (req, res, next) {

  var passBackData = {};
  passBackData.title = 'Classify Tweets';
  passBackData.feedback = false;
  const url = require('url');  
  classifier = new natural.BayesClassifier();
  natural.BayesClassifier.load('classifier.json', null, function (err, classifier) {
    if (req.body.pc == 1) {

      classifier.addDocument(req.body.query, "pro gun control");
    }
    else if(req.body.pc == 0){
      classifier.addDocument(req.body.query, "non pro gun control");

    }else{

      classifier.addDocument(req.body.query, "Neutral/News");
    }
   
    classifier.train();

    classifier.save('classifier.json', function (err, classifier) {
      // the classifier is saved to the classifier.json file!
      var passBackData = {};
      passBackData.title = 'Classify Tweets';
      passBackData.feedback = true;
      passBackData.feedbackMessage = "Thank you for the update.";
      res.redirect(url.format({
        pathname:"/classify"
      }));
      // res.redirect('/classify');
      // res.render('classify', { temp: passBackData });
    });
  });

});


router.post('/index-update', async function (req, res, next) {

  
  const url = require('url');  

  await qp.executeUpdatePromise("update test.pct set label = ? where id = ? ", [req.body.pc,req.body.id], testdbconfig);
  var docs = await qp.executeAndFetchPromise("select * from test.everything where id = ?",[req.body.id],testdbconfig);
  var client = solr.createClient();
  client.autoCommit = true;

  client.add(docs,function(err,obj){
    if(err){
       console.log(err);
    }else{
       console.log(obj);
    }
  });

  classifier = new natural.BayesClassifier();
  natural.BayesClassifier.load('classifier.json', null, function (err, classifier) {
    if (req.body.pc == 1) {

      classifier.addDocument(req.body.query, "pro gun control");
    }
    else if(req.body.pc == 0){
      classifier.addDocument(req.body.query, "non pro gun control");

    }else{

      classifier.addDocument(req.body.query, "Neutral/News");
    }
   
    classifier.train();



    classifier.save('classifier.json', function (err, classifier) {
      // the classifier is saved to the classifier.json file!
        res.redirect(url.format({
        pathname:"/"
      }));
      // res.redirect('/classify');
      // res.render('classify', { temp: passBackData });
    });
  });

});

// var natural = require('natural');

// console.log(natural.LevenshteinDistance('one', 'on'));


module.exports = router;

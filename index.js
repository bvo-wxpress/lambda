exports.handler = (event, context, callback) => {
    var wxp_dynamo_data = null;
    var wxp_ec2_data = null;
    var ec2_public_dns = '';
    //get the user name from api gateway
    // var cognito_username = event.requestContext.authorizer.claims['cognito:username'];
    // var email = event.requestContext.authorizer.claims['email'];
    var cognito_username = 'ede97585-21c7-46f1-a5e2-8cc460bfca99';
    var email = "vo.bee92@gmail.com";
    
    // Load the AWS SDK for Node.js
    var AWS = require('aws-sdk');
    // Set the region 
    AWS.config.update({region: 'us-east-1'});
    
    // Create the DynamoDB service object
    var dynamo = new AWS.DynamoDB(); //TODO SHOULD DEFINE API VERSION!
    var ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
    // console.log(dynamo);
    // return;
    var params = {
      TableName: 'WxPress',
      Key: {
        'UserId' : {S: cognito_username},
      }
    };
    var obj = {
    'cognito_username': cognito_username,
    'email': email,
        // 'event': event
    };
    var response = {
        "statusCode": 200,
        "headers": { 
            "Access-Control-Allow-Origin": "*" 
        },
        "body": null
    };
    

    // Call DynamoDB to read the item from the table
    function getDynamoData(){
         
        dynamo.getItem(params, function(err, data) {
          if (err) {
            obj.item = null;
            response.body = JSON.stringify(obj);
          } else {
            wxp_dynamo_data = data.Item;
            obj.wxpress_data = wxp_dynamo_data;
            getEc2Data();
          }
        });
    }
    function getEc2Data(){
        console.log(wxp_dynamo_data.instanceId.S);
        var ec2Params = {
            InstanceIds: [wxp_dynamo_data.instanceId.S]
        };
        ec2.describeInstances(ec2Params, function(err, data) {
          if (err) {
            console.log(err);
            obj.err = err;
            obj.ec2 = null;
          } else {
            // console.log("Success", JSON.stringify(data));
            obj.ec2 = data;
            wxp_ec2_data = data.Reservations[0].Instances[0];
            handleInstance();
            
          }
        });
    }
    function handleInstance(){
        console.log("FOO","handle instances");
        var instanceCode = wxp_ec2_data.State.Code;
        switch(instanceCode){
            case 80: //Stopped
            case 64:
                //start it!
                console.log("START IT!");
                startEc2();
                break;
            case 16: //running
                ec2_public_dns = wxp_ec2_data.PublicDnsName;
                console.log("ITS RUNNING");
                send();
                break;
            default:
                console.log("Code not handled");
                break;
        }
    }
    function startEc2(){
        var params = {
            'InstanceIds': [wxp_ec2_data.InstanceId],
            'DryRun': false
        }
        ec2.startInstances(params, function(err, data) {
            if (err) {
                console.log("Error", err);
            } else if (data) {
                console.log("Start Instance Success", data);
                waitForEc2();
                
            }
        });
    }
    function waitForEc2(){
        console.log("WAIT",'...');
        var params = {
          'InstanceIds': [wxp_ec2_data.InstanceId]
        };
        ec2.waitFor('instanceRunning', params, function(err, data) {
            if (err){
              console.log(err, err.stack);   
            }else{
              console.log("DONE WAITINGs",data);           // successful response
              getEc2Data();
            }
        });
    }
    function send(){
        console.log("Look for public");
        obj.ec2_data = wxp_ec2_data;
        obj.public_dns = ec2_public_dns;
        response.body = JSON.stringify(obj);
        callback(null, response);
    }
    getDynamoData();
};

exports.handler = (event, context, callback) => {
    var wxp_dynamo_data = null;
    var wxp_ec2_data = null;
    var ec2_public_dns = '';
    //get the user name from api gateway
    var cognito_username = event.requestContext.authorizer.claims['cognito:username'];
    var email = event.requestContext.authorizer.claims['email'];
    //FOR TESTING PURPOSES, REMOVE IN PRODUCTION
    // var cognito_username = 'ede97585-21c7-46f1-a5e2-8cc460bfca99';
    // var email = "vo.bee92@gmail.com";
    
    // Load the AWS SDK for Node.js
    var AWS = require('aws-sdk');
    // Set the region (May not be necessary)
    AWS.config.update({region: 'us-east-1'});
    
    // Create the DynamoDB service object
    var dynamo = new AWS.DynamoDB(); //TODO SHOULD DEFINE API VERSION!
    
    //Create EC2 Service object
    var ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
    
    //create return object and response for debugging purposes.
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
        "body": obj
    };
    

    // Call DynamoDB to read the item from the table
    function getDynamoData(){
       var params = {
          TableName: 'WxPress',
          Key: {
            'UserId' : {S: cognito_username},
          }
        };
        dynamo.getItem(params, function(err, data) {
          if (err) {
            response.body.error = err;
            send();
          } else {
            wxp_dynamo_data = data.Item;
            response.body.wxpress_data = wxp_dynamo_data;
            getEc2Data();
          }
        });
    }
    
    // fetch data of ec2 instance
    function getEc2Data(){
        var ec2Params = {
            InstanceIds: [wxp_dynamo_data.instanceId.S]
        };
        ec2.describeInstances(ec2Params, function(err, data) {
          if (err) {
            response.body.err = err;
            send();
          }else{
            wxp_ec2_data = data.Reservations[0].Instances[0];
            response.body.ec2 = wxp_ec2_data;
            handleInstance();
          }
        });
    }
    
    //Handler for instance state codes
    function handleInstance(){
        var instanceCode = wxp_ec2_data.State.Code;
        switch(instanceCode){
            case 80: //Stopped
                //start it!
                startEc2();
                break;
            case 16: //running
                ec2_public_dns = wxp_ec2_data.PublicDnsName;
                response.body.public_dns = ec2_public_dns;
                send();
                break;
            default:
                response.body.err = "EC2 State Code not handled.";
                send();
                break;
        }
    }
    
    //Initiate start of the ec2 instance
    function startEc2(){
        var params = {
            'InstanceIds': [wxp_ec2_data.InstanceId],
            'DryRun': false
        }
        ec2.startInstances(params, function(err, data) {
            if (err) {
                response.body.err = err;
                send();
            } else if (data) {
                waitForEc2();
            }
        });
    }
    
    //Wait for the ec2 instance to start
    function waitForEc2(){
        var params = {
          'InstanceIds': [wxp_ec2_data.InstanceId]
        };
        ec2.waitFor('instanceRunning', params, function(err, data) {
            if (err){
              response.body.err = err;
              send();
            }else{
              getEc2Data();
            }
        });
    }
    
    //send response to endpoint
    function send(){
        response.body = JSON.stringify(response.body);
        callback(null, response);
    }
    getDynamoData();
};

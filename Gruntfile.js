//Follow https://medium.com/@SlyFireFox/micro-services-with-aws-lambda-and-api-gateway-part-1-f11aaaa5bdef
//Run
//npm install -g grunt-cli
//npm install grunt-aws-lambda grunt-pack --save-dev

const grunt = require('grunt');
grunt.loadNpmTasks('grunt-aws-lambda');

grunt.initConfig({
    lambda_invoke: {
        default: {}
    },
    lambda_deploy: {
        awsLexInterceptor: {
            arn: 'arn:aws:lambda:us-east-1:894598711988:function:LexInterceptor-MsBotFxInterceptorFunction-UNEXH85X2GLX',
            options: {
                region: 'us-east-1',
                handler: 'msbotFxInterceptor.handler'
            }
        }
    },
    lambda_package: {
        awsLexInterceptor: {
            options: {
                include_time: false,
                include_version: false
            }
        }
    }
});

grunt.registerTask('deploy', ['lambda_package:awsLexInterceptor', 'lambda_deploy:awsLexInterceptor']);


aws s3 cp QrcodeDecoderLambda-1.0-SNAPSHOT-all.jar s3://howwhofeelinvideopackage/QrcodeDecoderLambda-1.0-SNAPSHOT-all.jar
node C:\Users\developer\AppData\Roaming\npm\node_modules\grunt-cli\bin\grunt --gruntfile ..\Gruntfile.js lambda_package
aws s3 cp ../dist/LexInterceptor_latest.zip s3://howwhofeelinvideopackage/LexInterceptor_latest.zip

aws cloudformation package ^
    --region us-east-1^
    --template-file LexInterceptor.yaml ^
    --s3-bucket %SourceBucket% ^
    --output-template-file LexInterceptor-packaged-template.yaml

aws cloudformation deploy ^
    --region us-east-1^
    --capabilities CAPABILITY_IAM ^
    --template-file LexInterceptor-packaged-template.yaml --stack-name LexInterceptor ^
    --parameter-overrides ^
    GoogleApiKey=%GoogleApiKey% ^
    FacebookPageToken=%FacebookPageToken% ^
    FacebookVerifyToken=%FacebookVerifyToken% ^
    BotName=%BotName% ^
    SourceBucket=%SourceBucket%


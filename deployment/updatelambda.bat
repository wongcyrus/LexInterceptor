node C:\Users\developer\AppData\Roaming\npm\node_modules\grunt-cli\bin\grunt --gruntfile ..\Gruntfile.js lambda_package
aws s3 cp ../dist/LexInterceptor_latest.zip s3://howwhofeelinvideopackage/LexInterceptor_latest.zip

aws lambda update-function-code --function-name LexInterceptor-MsBotFxInterceptorFunction-UNEXH85X2GLX --s3-bucket howwhofeelinvideopackage --s3-key LexInterceptor_latest.zip
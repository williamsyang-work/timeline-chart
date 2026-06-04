const path = require('path');

module.exports = {
    entry: ['./src/index.ts'],
    devtool: "source-map",
    devServer: {
        static: path.join(__dirname, 'public'),
        allowedHosts: 'all',
        hot: true,
        port: 6969
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
            {
                enforce: "pre",
                test: /\.js$/,
                loader: "source-map-loader"
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'lib')
    }
};

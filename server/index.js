var path = require('path'),
    fs = require('fs'),
    express = require('express'),
    app = express(),
    compression = require('compression'),
    exphbs = require('express-handlebars'),
    Promise = require('promise'),
    find = require('lodash.find'),
    assign = require('lodash.assign'),
    util = require('./util');

var rootDir = path.resolve(__dirname, '..'),
    clientDir = path.resolve(rootDir, 'client'),
    vendorDir = path.resolve(rootDir, 'node_modules');

var defaults = {
    components: path.resolve(process.cwd(), 'components'),
    data: path.resolve(process.cwd(), 'data'),
    static: path.resolve(process.cwd(), 'compiled'),
    staticPath: '/compiled',
    ext: 'html',
    middlewares: []
};

module.exports = function start(options) {

    var ext = options.ext || defaults.ext,
        componentDir = options.components || defaults.components,
        dataDir = options.data || defaults.data,
        staticDir = options.static || defaults.static,
        staticPath = options.staticPath || defaults.staticPath,
        middlewares = options.middlewares || defaults.middlewares;

    var ehbs = exphbs.create({
        defaultLayout: 'component',
        layoutsDir: clientDir,
        extname: '.html',
        partialsDir: componentDir
    });

    middlewares.forEach(function(middleware) {
        app.use(middleware);
    });

    app.engine(ext, ehbs.engine);
    app.set('views', [clientDir, componentDir]);
    app.set('view engine', ext);
    app.use(compression());
    app.use('/client', express.static(clientDir));
    app.use('/vendor', express.static(vendorDir));
    app.use(staticPath, express.static(staticDir));

    return new Promise(function(resolve, reject) {

        return ehbs.getPartials().then(function(partials) {

            return ehbs.getTemplates(componentDir).then(function(templates) {

                var data = util.getTemplateData(dataDir + '/**/*.json'),
                    components = util.getComponentsInfo(componentDir, templates, partials, data);

                app.get('/', function(req, res) {
                    res.render('styleguide', {
                        layout: false,
                        pages: components.typed
                    });
                });

                app.get('/all', function(req, res) {
                    res.render('all', {
                        layout: false,
                        components: components.flat,
                        staticPath: staticPath
                    });
                });

                app.get('/:type/:id', function(req, res) {
                    var component = find(components.flat, {type: req.params.type, name: req.params.id.replace('.' + ext, '')});
                    res.render(component.path, assign({staticPath: staticPath}, data, component));
                });

                app.set('port', (process.env.PORT || 3000));

                var server = app.listen(app.get('port'), function() {
                    var host = server.address().address,
                        port = server.address().port;
                    console.log('Styleguide server started at http://%s:%s', host, port)
                });

                resolve({
                    app: app,
                    server: server,
                    ehbs: ehbs
                })

            });
        }).catch(function() {
            reject.apply(null, arguments);
        });

    })

};

module.exports = {
    apps:[
        {
            id:'0',
            name:'myapp',
            script:'index.js',
            instances:0,
            exec_mode:'cluster',
            wait_ready:true,
            listen_timeout:50000,
        }
    ]
};

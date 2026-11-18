// var current_year = console.log(new Date().getFullYear());

var header_height = 0;
var footer_height = 0;

d3.json("./data.json", function(error, nodes_data) {
    if (error) throw error;
    // console.log(nodes_data);
    // var width = window.innerWidth,
    var height = window.innerHeight - header_height - footer_height;

    var svg = d3.select("svg");

    var width,
        height,
        center_x,
        center_y,
        y_scale;

    var image_path = './img/',
        radius = 27
        strength = -2000
        distance = 150;
        // var center_x = width / 2,
        // center_y = height / 2;

    // var center_x = width / 2,
    //     center_y = height / 2;
    //     svg.attr("width", width);
    //     svg.attr("height", height);


    var links_data = [];

    // Получаем массив links_data для d3 из информации о родителях объекта
    nodes_data.forEach(element => {
        if (element.father !== null) {
            links_data.push({
                "target": element.id,
                "source": element.father,
                "dna_type": element.isMale === true ? "y" : "x"
            });
        }
        if (element.mother !== null) {
            links_data.push({
                "target": element.id,
                "source": element.mother,
                "dna_type": "mt"
            });
        }
        element.birthYear = parseInt(element.birthDate.substr(0,4), 10);
    });

    // Шкала времени по Y: кусочно-линейная, пустые промежутки длиннее max_gap лет сжимаются до max_gap
    // ponytail: на сжатом участке подписи лет идут неравномерно, добавить маркер разрыва если будет путать
    var max_gap = 20;
    var px_per_year = 6; // минимум пикселей на год: при большом дереве svg выше окна, страница скроллится
    var years = nodes_data.map(d => d.birthYear).sort((a, b) => a - b)
        .filter((y, i, a) => i === 0 || y !== a[i - 1]);
    var virtual_years = [0];
    for (var i = 1; i < years.length; i++) {
        virtual_years.push(virtual_years[i - 1] + Math.min(years[i] - years[i - 1], max_gap));
    }
    var y_scale = d3.scaleLinear().domain(years);


    function draw() {
        var v_max = virtual_years[virtual_years.length - 1];
        width = window.innerWidth,
        height = Math.max(window.innerHeight - header_height - footer_height, v_max * px_per_year);
        center_x = width / 2,
        center_y = height / 2,
        svg.attr("width", width);
        svg.attr("height", height);
        y_scale.range(virtual_years.map(v => 50 + v / v_max * (height - 140))); // отступы под подписи узлов
        center_force = d3.forceCenter(center_x, center_y);
        simulation
            .force("charge_force", charge_force)
            .force("center_force", center_force)
            .force("link", link_force)
            .force("collide", d3.forceCollide(60).iterations(4)) // разводит ровесников (братья/сёстры) по горизонтали
            .force("generation_force", generation_force)
            .force("box_force", box_force);
        draw_y_years();

        simulation.alphaTarget(0.3).restart();
    }

    function draw_y_years() {
        // рисуем шкалу времени на Y
        var interval_in_px = 100; // ~ желаемый интервал
        var padding = 100 // отступ сверху/снизу
        var intervals_count = (height-padding*2)/interval_in_px >> 0;
            interval_in_px = (height-padding*2)/intervals_count;

        svg.selectAll("#y_year").remove();
        svg.selectAll("#arrow_names").remove();

        var i = 10;
        ['y-dna', 'x-dna', 'mt-dna'].forEach(element => {
            i+=10;
            svg.append("text")
                .attr("id","arrow_names")
                .attr("y", i)
                .attr("x", width - 30)
                .attr('text-anchor', 'middle')
                .attr("class", element+"-link")
                .text(element);
        });
        

        for (var i = 0; i <= intervals_count; i++) {
            svg.append("text")
                .attr("id","y_year")
                .attr("y", padding+(i*interval_in_px))
                .attr("x", width - 30)
                .attr('text-anchor', 'middle')
                //.attr("class", "myLabel")
                .text(parseInt(y_scale.invert(padding + i*interval_in_px)));
        }
    }

    var simulation = d3.forceSimulation().nodes(nodes_data);

    var link_force =  d3.forceLink(links_data).id(function(d) { return d.id; }).distance(distance); // сила по умолчанию 1/число связей: у многодетных родителей дети не стягиваются в одну точку

    var charge_force = d3.forceManyBody().strength(strength).distanceMax(400); // отталкивание только соседей, иначе крайние поколения прижимает к краям

    var center_force = d3.forceCenter(center_x, center_y);

    draw();

    // Не даем выходить g node(считаем высоту/ширину) за рамки svg
    function box_force(alpha) {
        for (var i = 0, n = nodes_data.length; i < n; ++i) {
            curr_node = nodes_data[i];
            bbox = d3.select("#id".concat(curr_node.id)).node().getBBox(); // height / width
            var x_min = bbox.width/2+5, x_max = width - bbox.width;
            curr_node.x = Math.max(x_min, Math.min(x_max, curr_node.x));
            curr_node.vx = Math.max(x_min - curr_node.x, Math.min(x_max - curr_node.x, curr_node.vx)); // иначе скорость выносит узел за край
            curr_node.y = Math.max(bbox.height/2, Math.min(height - bbox.height, curr_node.y));
        }
    }

    // Вытягиваем карту по дате рождения по вертикали
    function generation_force(alpha) {
        for (var i = 0, n = nodes_data.length; i < n; ++i) {
            curr_node = nodes_data[i];
            curr_node.y = y_scale(curr_node.birthYear);
            curr_node.vy = 0; // иначе charge/link сдвигают узел и он уезжает от своей отметки на шкале
        }
    }

    function showModalCard(d) {
        $( ".modal-body" ).empty();
        $('#modalCard').modal('show');
        // $('#modalCard').modal({show: true});
        $('#modalCardH2').text(d.name);
        $( '.modal-body' ).prepend('<img width="150" height="150" src=' + image_path + d.img +' />')
        $( ".modal-body" ).append( "<p>" + d.birthDate + " - " + d.deathDate + "</p>" )
    }
    // simulation
    //     .force("charge_force", charge_force)
    //     .force("center_force", center_force)
    //     .force("link", link_force)
    //     .force("generation_force", generation_force)
    //     .force("box_force", box_force);

    // add tick instructions:
    simulation.on("tick", tickActions );

    // Шаблоны стрелок для линий
    var svgdefs = svg.append("svg:defs");

    svgdefs.append("svg:marker")
        .attr("id", "triangle-y")
        .attr("refX", radius+12)
        .attr("refY", 6)
        .attr("markerWidth", 30)
        .attr("markerHeight", 30)
        .attr("markerUnits","userSpaceOnUse")
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M 0 0 12 6 0 12 3 6")
        .attr("class", "y-dna-arrow");

    svgdefs.append("svg:marker")
        .attr("id", "triangle-x")
        .attr("refX", radius+12)
        .attr("refY", 6)
        .attr("markerWidth", 30)
        .attr("markerHeight", 30)
        .attr("markerUnits","userSpaceOnUse")
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M 0 0 12 6 0 12 3 6")
        .attr("class", "x-dna-arrow");

    svgdefs.append("svg:marker")
        .attr("id", "triangle-mt")
        .attr("refX", radius+12)
        .attr("refY", 6)
        .attr("markerWidth", 30)
        .attr("markerHeight", 30)
        .attr("markerUnits","userSpaceOnUse")
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M 0 0 12 6 0 12 3 6")
        .attr("class", "mt-dna-arrow");

    // draw lines for the links

    var link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links_data)
        .enter().append("line")
        .attr("class", function(d) { return d.dna_type.concat('-dna-link'); })
        .attr("marker-end", function(d) { return "url(#triangle-".concat(d.dna_type).concat(")"); });
        // .attr("stroke-width", function(d) { return Math.sqrt(d.value); });

    var node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(nodes_data)
        .enter().append("g")
            .attr("id", function(d) { return 'id'.concat(d.id); })
            .on("click", function(d) {
                showModalCard(d)
            })
            .attr("class", "node");

    var circle = node
        .append("circle")
            .attr("r", radius)
            .attr("class", function(d) {
                return d.deathDate !== null ? "circleDead" : "circleAlive";
            });

    var lable = node.append("text")
        .text(function(d) { return d.name; })
        .attr('x', function(d) { return -d.name.length*6/2; })
        .attr('y', 37);
        // Пока закостылил моноширинный шрифт
        // Если использовать другой то придется высчитывать .clientWidth

    var age = node.append("text")
        .text(function(d) {
            return d.deathDate !== null ? d.birthDate.concat(" - ").concat(d.deathDate) : d.birthDate;
        })
        .attr('text-anchor', 'middle') // даты бывают неполные (только год)
        .attr('y', 37+16);

    node.append("title")
        .text(function(d) { return d.description ? d.name + "\n" + d.description : d.name; });

    var image = node.append("svg:image")
        .attr("xlink:href",  function(d) { return image_path + d.img;})
        .attr("x", function(d) { return -25;})
        .attr("y", function(d) { return -25;})
        .attr("height", radius*2-4)
        .attr("width", radius*2-4);

    var drag_handler = d3.drag()
        .on("start", drag_start)
        .on("drag", drag_drag)
        .on("end", drag_end);

    drag_handler(node);

    // Перетаскивание фона прокручивает страницу. d3.drag на узлах останавливает всплытие mousedown, сюда доходит только фон
    svg.on("mousedown.pan", function() {
        if (d3.event.button !== 0) return;
        var x0 = d3.event.clientX, y0 = d3.event.clientY;
        d3.event.preventDefault(); // без выделения текста
        d3.select(window)
            .on("mousemove.pan", function() {
                window.scrollBy(x0 - d3.event.clientX, y0 - d3.event.clientY);
                x0 = d3.event.clientX;
                y0 = d3.event.clientY;
            })
            .on("mouseup.pan", function() { d3.select(window).on(".pan", null); });
    });


    /** Functions **/

    //Function to choose what color circle we have
    //Let's return blue for males and red for females
    // function circleColour(d){
    // 	if(d.sex =="M"){
    // 		return "blue";
    // 	} else {
    // 		return "pink";
    // 	}
    // }

    //Function to choose the line colour and thickness
    //If the link type is "A" return green
    //If the link type is "E" return red
    // function linkColour(d){
    // 	if(d.type == "A"){
    // 		return "green";
    // 	} else {
    // 		return "red";
    // 	}
    // }

    // drag handler
    // d is the node
    function drag_start(d) {
    if (!d3.event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    // make sure you can't drag the circle outside the box
    function drag_drag(d) {
        // delta_x = d3.event.x - d.fx;
        // delta_y = d3.event.y - d.fy;
        // center_x = center_x + delta_x;
        // center_y = center_y + delta_y;
        // simulation.force("center", d3.forceCenter(center_x, center_y))
        // d.fx = Math.max(radius*3, Math.min(width - radius*3, d3.event.x));
        // d.fy = Math.max(radius*3, Math.min(height - radius*3, d3.event.y));
        d.fx = d3.event.x;
        d.fy = d3.event.y;
    }

    function drag_end(d) {
        if (!d3.event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;

        // console.log(parseInt(d.birthDate.substr(0,4), 10));
    }

    function tickActions() {

        // update circle positions each tick of the simulation
        // node
        //     .attr("cx", function(d) { return d.x; })
        //     .attr("cy", function(d) { return d.y; });
        node
            .attr("transform", function(d) {
                return "translate(" + d.x + "," + d.y + ")";
            })

        // update link positions
        link
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });
    }


    window.addEventListener("resize", draw);
});
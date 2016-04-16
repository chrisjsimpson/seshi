/*
JS Modified from a tutorial found here:
http://www.inwebson.com/html5/custom-html5-video-controls-with-jquery/

I really wanted to learn how to skin html5 video.
*/

plyr.setup();

(function(d, p){
var a = new XMLHttpRequest(),
    b = d.body;
a.open('GET', p, true);
a.send();
a.onload = function() {
    var c = d.createElement('div');
    c.setAttribute('hidden', '');
    c.innerHTML = a.responseText;
    b.insertBefore(c, b.childNodes[0]);
};
})(document, 'img/plyricons/sprite.svg');

//hide all

$(".btn-hide").click(function() {
    $("#addfilehide").toggleClass('showtoggle');
$("#hideall").toggleClass('showtoggle');

    // var txt = $("#hideall").is(':visible') ? 'Hide' : 'Show';
    if (!$("#hideall").is(':visible') ) {
        $('.btn-hide').find('i').toggleClass('fa-eye-slash')
    }
    //  $(".btn-hide").text(txt);

});

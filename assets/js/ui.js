/*!
 * Start Bootstrap - Grayscale Bootstrap Theme (http://startbootstrap.com)
 * Code licensed under the Apache License v2.0.
 * For details, see http://www.apache.org/licenses/LICENSE-2.0.
 */

// jQuery to collapse the navbar on scroll
$(document).ready(function() {

$(window).scroll(function() {
    if ($(".navbar").offset().top > 50) {
        $(".navbar-fixed-top").addClass("top-nav-collapse");
    } else {
        $(".navbar-fixed-top").removeClass("top-nav-collapse");
    }
});

// jQuery for page scrolling feature - requires jQuery Easing plugin
$(function() {
    $('a.page-scroll').bind('click', function(event) {
        var $anchor = $(this);
        $('html, body').stop().animate({
            scrollTop: $($anchor.attr('href')).offset().top
        }, 500, 'easeInOut');
        event.preventDefault();
    });
});

// Closes the Responsive Menu on Menu Item Click
$('.navbar-collapse ul li a').click(function() {
    $('.navbar-toggle:visible').click();
});

//Prevent chat box from close when clicked inside

// $('.drop-up').click(function(e) {
//        e.stopPropagation();
//    });


//send key expand

$("#copyclipboard").click(function () {
   $(this).hide();
    $(".copyclipboard-card ").css({
        width: '100%'
    });
    $(".copyclipboard-card").fadeIn(500);
});

//select all url key
$('#shareKeyInputElm').on('click',function(){ this.select(); });

//initiate tooltip
 $('[data-toggle="tooltip"]').tooltip();

//hide the hidebutton on load

$('.btn-hide').hide();

//dropzone

//scroll show extra upload button

var topOfOthDiv = $("#hideall").offset().top;
$(window).scroll(function() {
if($(window).scrollTop() > (topOfOthDiv - 130)) { //scrolled past the other div?
  $("#addmorefiles").css('opacity', '1') //reached the desired point -- show div
} else {
  $("#addmorefiles").css('opacity', '0')
}
});

// Google Maps Scripts
// When the window has finished loading create our google map below

//pyr plugin


$(".dialog").before("<div class='dialogBlack'></div>");

$(".dialog").prepend('<div id="close">x</div>');

});

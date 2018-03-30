$(document).ready(function() {
  $('.checkall').on('click', function(e) {
    $this = this;
    $.each($(this).parents('ul').find('input'), function(i, item) {
      $(item).prop('checked', $this.checked);
    });
    if ($("input[type='checkbox']").is(":checked")) {
      $.each($('.checkall').parents('ul').find('.file-item'), function(i, background) {
        $(background).addClass("yellowbackground");
      });
    } else {
      $.each($('.checkall').parents('ul').find('.file-item'), function(i, background) {
        $(background).removeClass("yellowbackground");
      });
    }
  });

  $("input[type='checkbox']").not('.checkall').change(function() {
    if ($(this).is(":checked")) {
      $(this).parent().addClass("yellowbackground");
    } else {
      $(this).parent().removeClass("yellowbackground");
    }
  });

  // uploading and receving files...

});


//Upload bar
/*
var myVar = setInterval(function() {
  myTimer()
}, 1); TODO use events, this runs once every millisecond (extreemly. cpu intensive :O ) 
var count = 2;

function myTimer() {
  if (count < 100) {
    $('.uploadbar').css('width', count + "%");
    count += 0.05;
    document.getElementById("percentupload").innerHTML = Math.round(count) + "%";
    // code to do when loading
  } else if (count > 99) {
    // code to do after loading
    count = 0;


  }
}
*/

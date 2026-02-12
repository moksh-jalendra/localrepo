let strkey = ''

function show(key){ 
    input = document.getElementById('screen');

    if ( key == 'enter'){
        if (Number.isInteger(Number(strkey.slice(-1))) ){

             val = String(eval(strkey))
             input.value = val ;
             strkey = val

        } else{
            input.value = 'plese enetr correct opretion'
        }

       
        


    } if (key == '<='){

        strkey = strkey.slice(0 , -1)
        
        input.value = strkey


    } if( key == '+' || key == '-' || key == '*' || key == '/' ){
       
        strkey = strkey + String(key)
        input.value = strkey ;
    } if( Number.isInteger(key) ){

         strkey = strkey + String(key)
         input.value = strkey ;

    } if(key == 'c'){
        strkey =''
        input.value = strkey 
    }


   



}






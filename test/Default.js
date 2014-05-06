describe("Default value test", function () {
    //when will
    //value fired -> on insert or first update
    //angular watch fired before one complete
    //show invoicelineitem:[] --> add listener will fire or not when they are getting changed in trigger
    //how to give invoice line item added/delete events
    //events
    //onRowAdded
    //onRowDeleted
    //onRowSaved
    //value
    //value:["status"]
    //value:["lineitems.amount"]
    //value:["lineitems.taxlineitems.taxamt"]
    it.skip("Task creation", function (done) {
        var taskCollection = {collection:"tasks", triggers:[
            {
                event:"rowAdded", function:"onTaskInsert",
                event:"value:['owner']", function:"onOwner"

            }
        ]}

        function onTaskInsert(doc, db, callback) {
            doc.comments = ["New task created by " + db.user.username];
            doc.status = "New"
            callback();
        }

        function onOwnerChange(doc, logger, db, callback) {
            //save a new comment
            var ownerName = doc.owner;
            db.batchUpdateById({$collection:"users", $upsert:{username:ownerName}}, function () {

            })
        }
    })

    it.skip("Invoice creation", function (done) {

        var invoiceCollection = {collection:"invoices", triggers:[
            {
                event:"", function:""
            }
        ]};

        function onRowAdded(doc) {
            doc.creation_date = new Date();
        }

        function onVendorChange(doc, log, db, callback) {
            var vendor = doc.vendor;
            //get deliveries
            db.query({$collection:"deliveries", $filter:{vendor:vendor}}, function (err, deliveries) {
                deliveries = deliveries.result;
                doc.totalAmt = 0;
                doc.invoiceLineItem = [];
                for (var i = 0; i < deliveries.length; i++) {
                    var lineitem = {}
                    lineitem.delivery = deliveries[i];
                    lineitem.amount = deliveries[i].amount;
                }

            })
        }

        function onLineItemAmountDelete(doc) {
            doc.parent.amount -= doc.old.amount;
        }

        function onLineItemAmountChanged(doc) {
            doc.parent.amount += doc.amount - doc.old.amount;
        }

        function onLineItemTaxAmountChanged(doc) {
            doc.parent.taxamount += doc.toalTaxAmt - doc.old.toalTaxAmt;
        }

        function onTaxLineItemAmountChange(doc) {
            doc.parent.toalTaxAmt += doc.taxAmt - doc.old.taxAmt;
        }

        function onTaxLineItemDelete(doc) {
            doc.parent.taxamount -= doc.old.toalTaxAmt;
        }

        function onInvoiceSave(doc, db, callback) {
            db.batchUpdateById({$collection:"vouchers", $insert:{}}, function (err, voucher) {
                db.batchUpdateById({$collection:"invoices", $update:{_id:doc.get("_id"), $set:{voucherid:voucher.$insert[0]._id}}}, function () {

                })
            })
        }


    })

})
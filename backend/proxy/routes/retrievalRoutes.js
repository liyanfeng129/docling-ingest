const express = require('express');

const retrievalController = require('../controllers/retrievalController');

const router = express.Router();

router.get('/collections', retrievalController.listCollections);
router.get('/collection/:collectionId/info', retrievalController.getCollectionInfo);
router.post('/search', retrievalController.search);

module.exports = router;
